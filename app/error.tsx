'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertOctagon, RefreshCw, LayoutDashboard, Radio, ShieldAlert } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Runtime error caught by error.tsx:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-rose-500 selection:text-white">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full text-center space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-mono mb-2 shadow-lg">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Error 500 • Error Interno del Servidor</span>
        </div>

        {/* Big Animated 500 Display */}
        <div className="relative flex items-center justify-center my-4">
          <span className="text-8xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-rose-200 via-rose-400 to-rose-800 select-none">
            500
          </span>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-rose-950/80 border border-rose-800 flex items-center justify-center backdrop-blur-sm shadow-2xl animate-pulse">
              <AlertOctagon className="w-12 h-12 text-rose-400" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100">
            Algo ha salido mal
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            Ha ocurrido un error inesperado al procesar tu solicitud. El equipo técnico ha registrado la incidencia.
          </p>

          {error?.digest && (
            <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg text-[10px] font-mono text-zinc-500 max-w-xs mx-auto truncate">
              Código de diagnóstico: <span className="text-zinc-300 font-bold">{error.digest}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reintentar Operación</span>
          </button>

          <Link
            href="/"
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Volver a la Visión General</span>
          </Link>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-zinc-900 text-[10px] font-mono text-zinc-600 flex items-center justify-center gap-2">
          <Radio className="w-3.5 h-3.5 text-zinc-500" />
          <span>Veredillas FM &copy; {new Date().getFullYear()} • Sistema de Gestión</span>
        </div>
      </div>
    </div>
  );
}
