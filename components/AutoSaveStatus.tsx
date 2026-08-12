'use client';

import { Save } from 'lucide-react';

interface AutoSaveStatusProps {
  lastAutoSavedAt: Date | null;
}

export default function AutoSaveStatus({ lastAutoSavedAt }: AutoSaveStatusProps) {
  if (!lastAutoSavedAt) return null;
  return (
    <p className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
      <Save className="w-3 h-3" />
      <span>
        Borrador autoguardado a las{' '}
        {lastAutoSavedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </p>
  );
}
