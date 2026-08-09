'use client';

import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-rose-950 border border-rose-800 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-zinc-100">Error Crítico del Sistema</h1>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ha ocurrido un error inesperado en la raíz de la aplicación. Por favor reintenta recargar la página.
            </p>
          </div>

          <button
            onClick={() => reset()}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 mx-auto shadow-lg shadow-rose-600/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recargar Aplicación</span>
          </button>
        </div>
      </body>
    </html>
  );
}
