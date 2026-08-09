'use client';

import React, { Suspense } from 'react';
import EpisodeEditorForm from '@/components/EpisodeEditorForm';
import { Loader2 } from 'lucide-react';

export default function NewEpisodePage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 flex justify-center text-zinc-500 gap-2 font-mono text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span>Cargando formulario...</span>
        </div>
      }
    >
      <EpisodeEditorForm isEdit={false} />
    </Suspense>
  );
}

