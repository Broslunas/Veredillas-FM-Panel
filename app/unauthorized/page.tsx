'use client';

import React from 'react';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-950/50 border border-red-900/60 text-red-400">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-zinc-100">Acceso Restringido</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Tu cuenta actual no posee permisos de <strong className="text-zinc-200">Administrador</strong> ni de <strong className="text-zinc-200">Propietario (Owner)</strong> para acceder al panel de gestión.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-2.5 px-4 rounded-xl text-sm transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión e Intentar con otra Cuenta</span>
          </button>

          <Link
            href="https://www.veredillasfm.es"
            className="block text-xs text-zinc-500 hover:text-zinc-400 transition"
          >
            Volver al sitio principal
          </Link>
        </div>
      </div>
    </div>
  );
}
