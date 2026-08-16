import { NextResponse } from 'next/server';
import { isAuthorizedRoute } from '@/lib/api-guard';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import ListenEvent from '@/models/ListenEvent';

export async function GET(request: Request) {
  try {
    const { authorized } = await isAuthorizedRoute(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days') || '30';
    const searchQuery = searchParams.get('search') || '';
    const roleFilter = searchParams.get('role') || 'all';

    const now = new Date();
    let daysNum = parseInt(daysParam, 10);
    if (isNaN(daysNum) || daysNum <= 0) daysNum = 30;

    const startDate = daysParam === 'all' ? new Date(0) : new Date(now.getTime() - daysNum * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // ── 1. KPI Counts ──
    const totalUsers = await User.countDocuments();
    const totalListens = await ListenEvent.countDocuments();
    const newUsersLast30 = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const newUsersLast7 = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const activeUsersLast30 = await User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } });

    // Listening Time aggregates
    const listeningAgg = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$listeningTime' }, avg: { $avg: '$listeningTime' }, max: { $max: '$listeningTime' } } },
    ]);
    const totalListeningSeconds = listeningAgg[0]?.total ?? 0;
    const avgListeningSeconds = listeningAgg[0]?.avg ?? 0;
    const maxListeningSeconds = listeningAgg[0]?.max ?? 0;

    const newsletterSubscribers = await User.countDocuments({ newsletter: true });
    const inactiveUsers = await User.countDocuments({ $or: [{ listeningTime: { $exists: false } }, { listeningTime: 0 }] });
    const usersWithFavorites = await User.countDocuments({ 'favorites.0': { $exists: true } });

    // Total favorites saved across all users
    const totalFavoritesAgg = await User.aggregate([
      { $project: { favCount: { $size: { $ifNull: ['$favorites', []] } } } },
      { $group: { _id: null, total: { $sum: '$favCount' } } }
    ]);
    const totalFavoritesSaved = totalFavoritesAgg[0]?.total ?? 0;

    // Users with active streak (> 0)
    const activeStreaksCount = await User.countDocuments({ currentStreak: { $gt: 0 } });

    // Completion rate
    const completionAgg = await User.aggregate([
      { $unwind: { path: '$playbackHistory', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: ['$playbackHistory.completed', 1, 0] } },
        },
      },
    ]);
    const totalPlays = completionAgg[0]?.total ?? 0;
    const completedPlays = completionAgg[0]?.completed ?? 0;
    const completionRate = totalPlays > 0 ? Math.round((completedPlays / totalPlays) * 100) : 0;

    // ── 2. User Growth (Last 12 Months) ──
    const twelveMonthsAgo = new Date(now.getTime());
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const userGrowthRaw = await User.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing months for 12 months
    const userGrowthMap = new Map(userGrowthRaw.map(g => [g._id, g.count]));
    const userGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${monthStr}`;
      userGrowth.push({ month: key, count: userGrowthMap.get(key) || 0 });
    }

    // ── 3. Listen Events Timeline (Dynamic filterable timeframe) ──
    const listenTimelineRaw = await ListenEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const listenTimeline = listenTimelineRaw.map((l) => ({ date: l._id, count: l.count }));

    // ── 4. Role Distribution ──
    const roleDistRaw = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const roleDistribution = roleDistRaw.map((r) => ({ role: r._id || 'user', count: r.count }));

    // ── 5. Hour Heatmap (Filtered by startDate) ──
    const hourDistRaw = await ListenEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const hourDistribution = Array.from({ length: 24 }, (_, h) => {
      const found = hourDistRaw.find((r) => r._id === h);
      return { hour: h, count: found?.count ?? 0 };
    });

    // Peak hour calculation
    const maxHourObj = hourDistribution.reduce((max, curr) => (curr.count > max.count ? curr : max), { hour: 0, count: 0 });

    // ── 6. Retention Buckets (Days since join) ──
    const retentionBucketsRaw = await User.aggregate([
      {
        $addFields: {
          daysSinceJoin: {
            $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $bucket: {
          groupBy: '$daysSinceJoin',
          boundaries: [0, 7, 30, 90, 180, 365, 99999],
          default: 'older',
          output: {
            count: { $sum: 1 },
            avgListening: { $avg: '$listeningTime' },
          },
        },
      },
    ]);
    const retentionBuckets = retentionBucketsRaw.map(b => ({
      key: String(b._id),
      count: b.count,
      avgListening: Math.round(b.avgListening || 0)
    }));

    // ── 7. Engagement Matrix Top 10 ──
    const engagementRaw = await User.aggregate([
      {
        $addFields: {
          favCount: { $size: { $ifNull: ['$favorites', []] } },
          completedCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$playbackHistory', []] },
                as: 'h',
                cond: { $eq: ['$$h.completed', true] },
              },
            },
          },
          streak: { $ifNull: ['$currentStreak', 0] }
        },
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: [{ $ifNull: ['$listeningTime', 0] }, 0.001] }, // 1 point per 1000s
              { $multiply: ['$favCount', 5] },
              { $multiply: ['$completedCount', 10] },
              { $multiply: ['$streak', 2] }
            ],
          },
        },
      },
      { $sort: { engagementScore: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          picture: 1,
          role: 1,
          engagementScore: 1,
          listeningTime: 1,
          favCount: 1,
          completedCount: 1,
          currentStreak: 1
        }
      },
    ]);

    // ── 8. Top 10 Listeners ──
    const topListeners = await User.find({ listeningTime: { $gt: 0 } })
      .sort({ listeningTime: -1 })
      .limit(10)
      .select('name email picture listeningTime lastLogin favorites createdAt role currentStreak completedEpisodes')
      .lean();

    // ── 9. Recent Top Episodes (Filtered by startDate) ──
    const recentTopEpisodesRaw = await ListenEvent.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      { $group: { _id: '$episodeSlug', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);
    const recentTopEpisodes = recentTopEpisodesRaw.map((e) => ({ slug: e._id, count: e.count }));

    // ── 10. Filterable User List Search & Table ──
    const userMatch: any = {};
    if (searchQuery.trim()) {
      userMatch.$or = [
        { name: { $regex: searchQuery.trim(), $options: 'i' } },
        { email: { $regex: searchQuery.trim(), $options: 'i' } }
      ];
    }
    if (roleFilter !== 'all') {
      userMatch.role = roleFilter;
    }

    const filteredUsers = await User.find(userMatch)
      .sort({ listeningTime: -1, createdAt: -1 })
      .limit(50)
      .select('name email picture role listeningTime favorites currentStreak maxStreak newsletter lastLogin createdAt')
      .lean();

    return NextResponse.json({
      kpis: {
        totalUsers,
        totalListens,
        newUsersLast30,
        newUsersLast7,
        activeUsersLast30,
        totalListeningSeconds,
        avgListeningSeconds,
        maxListeningSeconds,
        completionRate,
        newsletterSubscribers,
        inactiveUsers,
        usersWithFavorites,
        totalFavoritesSaved,
        activeStreaksCount
      },
      userGrowth,
      listenTimeline,
      hourDistribution,
      peakHour: maxHourObj,
      roleDistribution,
      retentionBuckets,
      engagementRaw,
      topListeners,
      recentTopEpisodes,
      filteredUsers,
    });
  } catch (error) {
    console.error('Error fetching admin user stats in panel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
