'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Radio, ArrowLeft, LayoutDashboard, HelpCircle, AlertCircle, Compass } from 'lucide-react';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-md w-full text-center space-y-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Brand Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-zinc-400 text-xs font-mono mb-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Error 404 • Veredillas FM Panel</span>
        </div>

        {/* Big Animated 404 Display */}
        <div className="relative flex items-center justify-center my-4">
          <span className="text-8xl sm:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-zinc-200 via-zinc-400 to-zinc-700 select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-24 h-24 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center backdrop-blur-sm shadow-2xl animate-bounce">
              <Compass className="w-12 h-12 text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-100">
            Página No Encontrada
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            La ruta o recurso al que intentas acceder no existe, ha sido movido o no dispones de los permisos adecuados.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Volver a la Visión General</span>
          </Link>

          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold px-5 py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Página Anterior</span>
          </button>
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
