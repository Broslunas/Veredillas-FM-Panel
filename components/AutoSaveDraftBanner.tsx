'use client';

import { Undo2, X } from 'lucide-react';

interface AutoSaveDraftBannerProps {
  savedAt: Date | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function AutoSaveDraftBanner({ savedAt, onRestore, onDiscard }: AutoSaveDraftBannerProps) {
  return (
    <div className="p-3 bg-amber-950/40 border border-amber-900/60 rounded-lg text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 font-mono">
      <span className="flex-1">
        Se encontró un borrador autoguardado
        {savedAt ? ` de las ${savedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''} con
        cambios sin guardar. ¿Quieres recuperarlo?
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex items-center gap-1.5 bg-amber-900/60 hover:bg-amber-900 text-amber-100 px-3 py-1.5 rounded-lg transition"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Recuperar</span>
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 text-amber-300/80 hover:text-amber-100 px-2 py-1.5 rounded-lg transition"
        >
          <X className="w-3.5 h-3.5" />
          <span>Descartar</span>
        </button>
      </div>
    </div>
  );
}
