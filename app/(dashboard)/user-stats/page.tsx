'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Activity,
  Headphones,
  Clock,
  Flame,
  Award,
  Mail,
  RefreshCw,
  Search,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
  Zap,
  Radio,
  UserCheck,
  UserX,
  X,
  ChevronRight,
  ShieldCheck,
  Crown,
  Heart,
  ExternalLink
} from 'lucide-react';

interface StatsData {
  kpis: {
    totalUsers: number;
    totalListens: number;
    newUsersLast30: number;
    newUsersLast7: number;
    activeUsersLast30: number;
    totalListeningSeconds: number;
    avgListeningSeconds: number;
    maxListeningSeconds: number;
    completionRate: number;
    newsletterSubscribers: number;
    inactiveUsers: number;
    usersWithFavorites: number;
    totalFavoritesSaved: number;
    activeStreaksCount: number;
  };
  userGrowth: { month: string; count: number }[];
  listenTimeline: { date: string; count: number }[];
  hourDistribution: { hour: number; count: number }[];
  peakHour: { hour: number; count: number };
  roleDistribution: { role: string; count: number }[];
  retentionBuckets: { key: string; count: number; avgListening: number }[];
  engagementRaw: any[];
  topListeners: any[];
  recentTopEpisodes: { slug: string; count: number }[];
  filteredUsers: any[];
}

export default function UserStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90' | '365' | 'all'>('30');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'directory'>('overview');

  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        days: timeframe,
        search,
        role: roleFilter,
      });
      const res = await fetch(`/api/admin/user-stats?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error fetching user stats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeframe, search, roleFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStats(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStats]);

  function fmtTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h >= 100) return `${h.toLocaleString('es-ES')}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function fmtNum(n: number): string {
    return (n || 0).toLocaleString('es-ES');
  }

  const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  function formatMonthLabel(mStr: string) {
    const [y, m] = mStr.split('-');
    const monthIdx = parseInt(m, 10) - 1;
    return `${MONTH_NAMES[monthIdx] || m} '${y ? y.slice(2) : ''}`;
  }

  function formatHourLabel(h: number) {
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  const retentionLabels: Record<string, string> = {
    '0': '0-7 días',
    '7': '8-30 días',
    '30': '1-3 meses',
    '90': '3-6 meses',
    '180': '6-12 meses',
    '365': '+1 año',
    'older': 'Muy antiguos'
  };

  if (loading && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando analíticas avanzadas...</span>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalUsers: 0,
    totalListens: 0,
    newUsersLast30: 0,
    newUsersLast7: 0,
    activeUsersLast30: 0,
    totalListeningSeconds: 0,
    avgListeningSeconds: 0,
    maxListeningSeconds: 0,
    completionRate: 0,
    newsletterSubscribers: 0,
    inactiveUsers: 0,
    usersWithFavorites: 0,
    totalFavoritesSaved: 0,
    activeStreaksCount: 0
  };

  const activeRate = kpis.totalUsers > 0 ? Math.round((kpis.activeUsersLast30 / kpis.totalUsers) * 100) : 0;
  const newsletterRate = kpis.totalUsers > 0 ? Math.round((kpis.newsletterSubscribers / kpis.totalUsers) * 100) : 0;
  const inactiveRate = kpis.totalUsers > 0 ? Math.round((kpis.inactiveUsers / kpis.totalUsers) * 100) : 0;
  const favRate = kpis.totalUsers > 0 ? Math.round((kpis.usersWithFavorites / kpis.totalUsers) * 100) : 0;

  const maxGrowth = Math.max(...(data?.userGrowth.map(g => g.count) || [1]), 1);
  const maxListenTimeline = Math.max(...(data?.listenTimeline.map(l => l.count) || [1]), 1);
  const maxHourCount = Math.max(...(data?.hourDistribution.map(h => h.count) || [1]), 1);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 uppercase tracking-wide flex items-center gap-1">
              <Zap className="w-3 h-3 text-indigo-400" /> Executive Analytics 2.0
            </span>
            {autoRefresh && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Auto (30s)
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 mt-2 flex items-center gap-3">
            <span>Analíticas de Usuarios</span>
            <TrendingUp className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Panel de control avanzado de retención, engagement, horas escuchadas y comportamiento de la audiencia.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Broslytics External Pop-up Button */}
          <button
            onClick={() => {
              window.open(
                'https://analytics.broslunas.com/share/EbieAikRrucZqa03',
                'BroslyticsWindow',
                'width=1280,height=850,scrollbars=yes,resizable=yes'
              );
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-xs font-bold shadow-md transition border border-indigo-400/30"
            title="Abrir analíticas externas Broslytics en ventana emergente"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Broslytics</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>

          {/* Timeframe selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 flex items-center gap-1">
            {[
              { id: '7', label: '7D' },
              { id: '30', label: '30D' },
              { id: '90', label: '90D' },
              { id: '365', label: '1 Año' },
              { id: 'all', label: 'Todo' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTimeframe(t.id as any)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition ${
                  timeframe === t.id
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Alternar refresco automático cada 30s"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* ── KPI GRID ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        {/* KPI 1: Total Users */}
        <div className="bg-zinc-900/70 border border-indigo-900/40 hover:border-indigo-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Usuarios</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {fmtNum(kpis.totalUsers)}
          </div>
          <div className="text-[11px] text-indigo-400 flex items-center gap-1 font-medium">
            <Sparkles className="w-3 h-3" /> +{fmtNum(kpis.newUsersLast30)} este mes (+{kpis.newUsersLast7} en 7d)
          </div>
        </div>

        {/* KPI 2: Active Users */}
        <div className="bg-zinc-900/70 border border-emerald-900/40 hover:border-emerald-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Activos (30d)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {fmtNum(kpis.activeUsersLast30)}
          </div>
          <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" /> {activeRate}% de tasa de actividad
          </div>
        </div>

        {/* KPI 3: Total Listening Time */}
        <div className="bg-zinc-900/70 border border-amber-900/40 hover:border-amber-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Tiempo Total</span>
            <div className="w-7 h-7 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {fmtTime(kpis.totalListeningSeconds)}
          </div>
          <div className="text-[11px] text-amber-400 flex items-center gap-1 font-medium">
            <Headphones className="w-3 h-3" /> {fmtTime(kpis.avgListeningSeconds)} promedio/usuario
          </div>
        </div>

        {/* KPI 4: Plays & Completion */}
        <div className="bg-zinc-900/70 border border-purple-900/40 hover:border-purple-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Reproducciones</span>
            <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {fmtNum(kpis.totalListens)}
          </div>
          <div className="text-[11px] text-purple-400 flex items-center gap-1 font-medium">
            <BarChart3 className="w-3 h-3" /> {kpis.completionRate}% completados
          </div>
        </div>

        {/* KPI 5: Streaks & Favorites */}
        <div className="bg-zinc-900/70 border border-rose-900/40 hover:border-rose-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Rachas & Favs</span>
            <div className="w-7 h-7 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono flex items-center gap-2">
            <span>{fmtNum(kpis.activeStreaksCount)}</span>
            <span className="text-xs text-rose-400 font-normal font-sans">rachas</span>
          </div>
          <div className="text-[11px] text-rose-400 flex items-center gap-1 font-medium">
            <Heart className="w-3 h-3" /> {fmtNum(kpis.totalFavoritesSaved)} favs guardados ({favRate}%)
          </div>
        </div>

        {/* KPI 6: Newsletter & Inactives */}
        <div className="bg-zinc-900/70 border border-sky-900/40 hover:border-sky-700/60 rounded-xl p-4 transition space-y-2 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium">Newsletter</span>
            <div className="w-7 h-7 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {fmtNum(kpis.newsletterSubscribers)}
          </div>
          <div className="text-[11px] text-sky-400 flex items-center gap-1 font-medium">
            <UserCheck className="w-3 h-3" /> {newsletterRate}% suscritos ({inactiveRate}% inactivos)
          </div>
        </div>
      </div>

      {/* ── MAIN TABS ── */}
      <div className="flex items-center gap-2 border-b border-zinc-800">
        {[
          { id: 'overview', label: 'Visión General & Gráficos', icon: BarChart3 },
          { id: 'leaderboard', label: 'Top Oyentes & Engagement', icon: Crown },
          { id: 'directory', label: 'Directorio de Usuarios', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition flex items-center gap-2 ${
                isActive
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & CHARTS ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Row 1: Growth & Daily Plays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" /> Crecimiento de Usuarios
                  </h2>
                  <p className="text-xs text-zinc-500">Nuevos registros mensuales (Últimos 12 meses)</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {fmtNum(data?.userGrowth.reduce((s, g) => s + g.count, 0) || 0)} total
                </span>
              </div>

              <div className="h-48 flex items-end gap-1.5 pt-6 pb-2 border-b border-zinc-800/60 px-1">
                {data?.userGrowth.map((g, idx) => {
                  const pct = maxGrowth > 0 ? (g.count / maxGrowth) * 100 : 0;
                  return (
                    <div key={g.month || idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition bg-zinc-800 text-zinc-100 text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none z-10 whitespace-nowrap">
                        {g.count} usuarios ({g.month})
                      </div>
                      <div className="w-full bg-zinc-800/80 rounded-t-sm flex flex-col justify-end overflow-hidden h-full">
                        <div
                          style={{ height: `${Math.max(pct, 4)}%` }}
                          className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:from-indigo-500 group-hover:to-indigo-300 transition-all rounded-t-sm"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500 truncate w-full text-center">
                        {formatMonthLabel(g.month)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Play Events Timeline */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" /> Línea de Tiempo de Escucha
                  </h2>
                  <p className="text-xs text-zinc-500">Eventos de escucha diarios ({timeframe === 'all' ? 'Histórico' : `Últimos ${timeframe} días`})</p>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {fmtNum(data?.listenTimeline.reduce((s, l) => s + l.count, 0) || 0)} plays
                </span>
              </div>

              {(!data?.listenTimeline || data.listenTimeline.length === 0) ? (
                <div className="h-48 flex items-center justify-center text-xs text-zinc-500 font-mono">
                  Sin eventos de escucha registrados en este período.
                </div>
              ) : (
                <div className="h-48 flex items-end gap-1 pt-6 pb-2 border-b border-zinc-800/60 px-1 overflow-x-auto">
                  {data.listenTimeline.map((l, idx) => {
                    const pct = maxListenTimeline > 0 ? (l.count / maxListenTimeline) * 100 : 0;
                    const dateObj = new Date(l.date);
                    const dayLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                    return (
                      <div key={l.date || idx} className="flex-1 min-w-[8px] flex flex-col items-center gap-1.5 h-full justify-end group relative">
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition bg-zinc-800 text-zinc-100 text-[10px] font-mono px-2 py-0.5 rounded shadow pointer-events-none z-10 whitespace-nowrap">
                          {l.count} reproducciones ({l.date})
                        </div>
                        <div className="w-full bg-zinc-800/80 rounded-t-sm flex flex-col justify-end overflow-hidden h-full">
                          <div
                            style={{ height: `${Math.max(pct, 4)}%` }}
                            className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500 group-hover:to-emerald-300 transition-all rounded-t-sm"
                          />
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 truncate w-full text-center">
                          {idx % Math.ceil(data.listenTimeline.length / 10) === 0 ? dayLabel : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Hourly Heatmap & Role/Retention */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hourly Heatmap (24h) */}
            <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-purple-400" /> Horario Pico de Escucha (24h)
                  </h2>
                  <p className="text-xs text-zinc-500">Distribución de eventos por hora del día</p>
                </div>
                {data?.peakHour && (
                  <div className="text-xs font-mono px-2.5 py-1 rounded bg-purple-950 border border-purple-800/80 text-purple-300 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" /> Peak: {formatHourLabel(data.peakHour.hour)} ({data.peakHour.count} plays)
                  </div>
                )}
              </div>

              <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
                {data?.hourDistribution.map((h) => {
                  const intensity = maxHourCount > 0 ? h.count / maxHourCount : 0;
                  const isPeak = data.peakHour && data.peakHour.hour === h.hour && h.count > 0;
                  return (
                    <div
                      key={h.hour}
                      className={`p-2.5 rounded-lg border flex flex-col items-center justify-center transition group relative ${
                        isPeak
                          ? 'bg-purple-600/30 border-purple-500/80 shadow-md shadow-purple-600/20'
                          : h.count > 0
                          ? 'bg-zinc-800/60 border-zinc-700/50 hover:bg-zinc-800'
                          : 'bg-zinc-950/40 border-zinc-800/40 opacity-50'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-zinc-400 font-semibold">{formatHourLabel(h.hour)}</span>
                      <span className={`text-xs font-mono font-bold mt-1 ${isPeak ? 'text-amber-300' : 'text-zinc-200'}`}>
                        {h.count}
                      </span>
                      {/* Intensity bar indicator */}
                      <div className="w-full bg-zinc-950 h-1 rounded-full mt-1.5 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(intensity * 100, 5)}%` }}
                          className={`h-full ${isPeak ? 'bg-amber-400' : 'bg-purple-400'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Retention Cohorts */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-400" /> Antigüedad de Usuarios
                </h2>
                <p className="text-xs text-zinc-500">Distribución por días transcurridos desde el registro</p>
              </div>

              <div className="space-y-3 pt-2">
                {data?.retentionBuckets.map((b) => {
                  const pct = kpis.totalUsers > 0 ? Math.round((b.count / kpis.totalUsers) * 100) : 0;
                  return (
                    <div key={b.key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-400">{retentionLabels[b.key] || b.key}</span>
                        <span className="text-zinc-200 font-bold">{fmtNum(b.count)} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LEADERBOARD & ENGAGEMENT ── */}
      {activeTab === 'leaderboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 10 Oyentes (2 cols) */}
          <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" /> Top 10 Oyentes Principales
                </h2>
                <p className="text-xs text-zinc-500">Usuarios con mayor tiempo acumulado de escucha</p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-950 border border-amber-800 text-amber-300">
                Máx: {fmtTime(kpis.maxListeningSeconds)}
              </span>
            </div>

            {(!data?.topListeners || data.topListeners.length === 0) ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-500">
                Sin oyentes registrados con tiempo de reproducción.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.topListeners.map((u, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div
                      key={u._id || idx}
                      onClick={() => setSelectedUser(u)}
                      className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/80 hover:bg-zinc-800/80 hover:border-zinc-700 transition cursor-pointer flex items-center gap-3 group"
                    >
                      {/* Rank Badge */}
                      <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center font-bold text-sm shrink-0">
                        {medals[idx] || <span className="text-xs font-mono text-zinc-400">#{idx + 1}</span>}
                      </div>

                      {/* Avatar */}
                      {u.picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.picture} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-zinc-700" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {u.name?.charAt(0)}
                        </div>
                      )}

                      {/* User Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-zinc-100 truncate group-hover:text-indigo-400 transition">{u.name}</p>
                          {u.role !== 'user' && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {u.role}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{u.email}</p>
                      </div>

                      {/* Time Stat */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono font-bold text-amber-400">
                          {fmtTime(u.listeningTime)}
                        </div>
                        {u.currentStreak > 0 && (
                          <span className="text-[10px] font-mono text-rose-400 flex items-center gap-0.5 justify-end">
                            <Flame className="w-3 h-3" /> {u.currentStreak}d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Episodios Calientes */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" /> Episodios Calientes
              </h2>
              <p className="text-xs text-zinc-500">Más escuchados en el período seleccionado</p>
            </div>

            {(!data?.recentTopEpisodes || data.recentTopEpisodes.length === 0) ? (
              <div className="p-8 text-center text-xs font-mono text-zinc-500">
                Sin datos de episodios recientes.
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentTopEpisodes.map((ep, idx) => {
                  const maxEpPlays = data.recentTopEpisodes[0]?.count || 1;
                  const pct = Math.round((ep.count / maxEpPlays) * 100);
                  return (
                    <div key={ep.slug || idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-zinc-200 truncate max-w-[180px]" title={ep.slug}>
                          #{idx + 1} {ep.slug}
                        </span>
                        <span className="font-mono font-bold text-indigo-400">{fmtNum(ep.count)} plays</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: DIRECTORY & SEARCH ── */}
      {activeTab === 'directory' && (
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Directorio & Búsqueda de Usuarios
              </h2>
              <p className="text-xs text-zinc-500">Filtra y revisa las estadísticas individuales de cada usuario</p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar nombre o email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
              >
                <option value="all">Todos los roles</option>
                <option value="user">Usuario</option>
                <option value="admin">Admin</option>
                <option value="owner">Propietario</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {(!data?.filteredUsers || data.filteredUsers.length === 0) ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500">
              No se encontraron usuarios matching los criterios de búsqueda.
            </div>
          ) : (
            <div className="border border-zinc-800/80 rounded-lg overflow-hidden divide-y divide-zinc-800/60">
              <div className="bg-zinc-950/80 px-4 py-2.5 grid grid-cols-12 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                <span className="col-span-4">Usuario</span>
                <span className="col-span-2">Rol</span>
                <span className="col-span-2">Tiempo Escuchado</span>
                <span className="col-span-2">Racha Actual</span>
                <span className="col-span-2 text-right">Último Acceso</span>
              </div>

              {data.filteredUsers.map((u) => (
                <div
                  key={u._id}
                  onClick={() => setSelectedUser(u)}
                  className="px-4 py-3 grid grid-cols-12 items-center text-xs hover:bg-zinc-900/90 transition cursor-pointer"
                >
                  {/* User info */}
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    {u.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.picture} alt={u.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 font-bold text-xs flex items-center justify-center shrink-0">
                        {u.name?.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 truncate">{u.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="col-span-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${
                      u.role === 'owner'
                        ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                        : u.role === 'admin'
                        ? 'bg-purple-950/60 border-purple-800 text-purple-300'
                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
                    }`}>
                      {u.role}
                    </span>
                  </div>

                  {/* Listening time */}
                  <div className="col-span-2 font-mono font-bold text-amber-400">
                    {fmtTime(u.listeningTime)}
                  </div>

                  {/* Streak */}
                  <div className="col-span-2 font-mono">
                    {u.currentStreak > 0 ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> {u.currentStreak} días
                      </span>
                    ) : (
                      <span className="text-zinc-600">Sin racha</span>
                    )}
                  </div>

                  {/* Last Login */}
                  <div className="col-span-2 text-right text-[11px] font-mono text-zinc-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('es-ES') : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── USER DETAIL MODAL ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
              {selectedUser.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedUser.picture} alt={selectedUser.name} className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/50" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-indigo-950 border-2 border-indigo-800 text-indigo-300 font-bold text-xl flex items-center justify-center">
                  {selectedUser.name?.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-zinc-100">{selectedUser.name}</h3>
                <p className="text-xs text-zinc-400 font-mono">{selectedUser.email}</p>
                <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Rol: {selectedUser.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Tiempo de Escucha</span>
                <p className="font-mono font-bold text-amber-400 text-base">{fmtTime(selectedUser.listeningTime)}</p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Racha Actual / Máx</span>
                <p className="font-mono font-bold text-rose-400 text-base flex items-center gap-1">
                  <Flame className="w-4 h-4" /> {selectedUser.currentStreak || 0}d / {selectedUser.maxStreak || 0}d
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Favoritos Guardados</span>
                <p className="font-mono font-bold text-purple-400 text-base">
                  {selectedUser.favorites?.length || 0} episodios
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Newsletter</span>
                <p className="font-mono font-bold text-emerald-400 text-base flex items-center gap-1">
                  {selectedUser.newsletter ? <CheckCircle2 className="w-4 h-4" /> : <UserX className="w-4 h-4 text-zinc-500" />}
                  {selectedUser.newsletter ? 'Suscrito' : 'No suscrito'}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono space-y-1 border-t border-zinc-800 pt-3">
              <p>Registro: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('es-ES') : 'N/A'}</p>
              <p>Último acceso: {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('es-ES') : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
