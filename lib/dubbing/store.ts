import dbConnect from '@/lib/mongodb';
import EpisodeContent, { IDubTrack, IEpisodeContent } from '@/models/EpisodeContent';

type EpisodeLean = IEpisodeContent & { _id: any };

/**
 * Load an episode and a specific dub track by language. Throws a plain Error with a
 * user-facing message on failure — callers map that to a 404/400 JSON response.
 */
export async function getEpisodeWithTrack(
  episodeId: string,
  lang: string
): Promise<{ episode: EpisodeLean; track: IDubTrack }> {
  await dbConnect();
  const episode = await EpisodeContent.findById(episodeId).lean<EpisodeLean>();
  if (!episode) throw new Error('Episodio no encontrado');

  const track = (episode.dubs || []).find((d) => d.lang === lang);
  if (!track) throw new Error(`No existe una pista de doblaje para el idioma "${lang}" en este episodio`);

  return { episode, track };
}

/** Persist a fully-mutated track back onto the episode's `dubs` array. */
export async function saveTrack(episodeId: string, lang: string, track: IDubTrack): Promise<void> {
  await dbConnect();
  const result = await EpisodeContent.updateOne(
    { _id: episodeId, 'dubs.lang': lang },
    { $set: { 'dubs.$': track } }
  );
  if (result.matchedCount === 0) {
    throw new Error('No se pudo guardar la pista de doblaje (episodio o pista no encontrados)');
  }
}

/**
 * Add a new track for `track.lang`. Refuses if a non-error track already exists for
 * that language; replaces a previous errored attempt.
 */
export async function addTrack(episodeId: string, track: IDubTrack): Promise<void> {
  await dbConnect();
  const episode = await EpisodeContent.findById(episodeId);
  if (!episode) throw new Error('Episodio no encontrado');

  const existing = (episode.dubs || []).find((d: any) => d.lang === track.lang);
  if (existing && existing.status !== 'error') {
    throw new Error(`Ya existe una pista de doblaje para "${track.lang}" (estado: ${existing.status})`);
  }

  episode.dubs = [...(episode.dubs || []).filter((d: any) => d.lang !== track.lang), track] as any;
  await episode.save();
}

/** Remove a track entirely (used for admin cleanup/regeneration). */
export async function removeTrack(episodeId: string, lang: string): Promise<void> {
  await dbConnect();
  await EpisodeContent.updateOne({ _id: episodeId }, { $pull: { dubs: { lang } } });
}
