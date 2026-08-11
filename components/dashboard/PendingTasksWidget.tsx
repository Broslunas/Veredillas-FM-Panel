'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileEdit, Calendar, Loader2 } from 'lucide-react';

interface PendingTasksWidgetProps {
  episodes: any[];
}

export default function PendingTasksWidget({ episodes }: PendingTasksWidgetProps) {
  const [pendingInterviews, setPendingInterviews] = useState<any[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);

  useEffect(() => {
    fetch('/api/admin/interviews')
      .then((r) => (r.ok ? r.json() : { requests: [] }))
      .then((data) => {
        const requests = Array.isArray(data.requests) ? data.requests : [];
        setPendingInterviews(requests.filter((r: any) => r.status === 'pending'));
      })
      .catch(() => {})
      .finally(() => setLoadingInterviews(false));
  }, []);

  const drafts = episodes.filter((ep) => ep.status === 'draft');

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-4">
      <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide font-mono">
        Tareas Pendientes
      </h2>

      <div className="space-y-2">
        <Link
          href="/episodes?status=draft"
          className="flex items-center justify-between gap-2 text-xs hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 -mx-2 transition"
        >
          <span className="flex items-center gap-2 text-zinc-300">
            <FileEdit className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            Borradores de episodios sin publicar
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
            {drafts.length}
          </span>
        </Link>

        <Link
          href="/interviews"
          className="flex items-center justify-between gap-2 text-xs hover:bg-zinc-800/60 rounded-lg px-2 py-1.5 -mx-2 transition"
        >
          <span className="flex items-center gap-2 text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            Entrevistas sin responder
          </span>
          {loadingInterviews ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500 shrink-0" />
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
              {pendingInterviews.length}
            </span>
          )}
        </Link>
      </div>

      {drafts.length === 0 && pendingInterviews.length === 0 && !loadingInterviews && (
        <p className="text-xs text-zinc-500 font-mono">Todo al día &mdash; sin tareas pendientes.</p>
      )}
    </div>
  );
}
