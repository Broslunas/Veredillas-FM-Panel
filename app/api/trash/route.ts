import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import BlogPost from '@/models/BlogPost';
import Guest from '@/models/Guest';
import Team from '@/models/Team';
import { isAuthorizedAdmin } from '@/lib/api-guard';

const COLLECTIONS: Record<string, { model: any; titleField: string }> = {
  episodes: { model: EpisodeContent, titleField: 'title' },
  blog: { model: BlogPost, titleField: 'title' },
  guests: { model: Guest, titleField: 'name' },
  team: { model: Team, titleField: 'name' },
};

export async function GET(request: Request) {
  const { authorized } = await isAuthorizedAdmin(request);
  if (!authorized) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const collectionFilter = searchParams.get('collection');

  await dbConnect();

  const entries = Object.entries(COLLECTIONS).filter(
    ([key]) => !collectionFilter || key === collectionFilter
  );

  const results = await Promise.all(
    entries.map(async ([key, { model, titleField }]) => {
      const docs = await model.find({ deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
      return docs.map((doc: any) => ({
        collection: key,
        id: doc._id.toString(),
        title: doc[titleField],
        slug: doc.slug,
        image: doc.image || null,
        deletedAt: doc.deletedAt,
      }));
    })
  );

  const items = results.flat().sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );

  return NextResponse.json({ items });
}
