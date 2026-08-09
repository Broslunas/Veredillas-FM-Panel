'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import EpisodeEditorForm from '@/components/EpisodeEditorForm';
import { Loader2 } from 'lucide-react';

export default function EditEpisodePage() {
  const params = useParams();
  const id = params?.id as string;
  const [episode, setEpisode] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEpisode() {
      try {
        const res = await fetch(`/api/episodes/${id}`);
        if (!res.ok) {
          throw new Error('Episodio no encontrado');
        }
        const data = await res.json();
        setEpisode(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el episodio');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadEpisode();
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando episodio...</span>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="p-12 text-center text-red-400 font-mono text-xs">
        {error || 'No se pudo cargar el episodio.'}
      </div>
    );
  }

  return (
    <React.Suspense
      fallback={
        <div className="p-12 flex justify-center text-zinc-500 gap-2 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Cargando formulario...</span>
        </div>
      }
    >
      <EpisodeEditorForm initialData={episode} isEdit={true} />
    </React.Suspense>
  );
}
