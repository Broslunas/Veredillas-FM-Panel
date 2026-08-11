'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageSquare } from 'lucide-react';

interface PendingComment {
  _id: string;
  name: string;
  text?: string;
  slug: string;
  createdAt: string;
}

export default function PendingCommentsWidget() {
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/comments?status=unverified')
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((data) => setComments(Array.isArray(data) ? data : data.comments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide font-mono">
          Comentarios Pendientes
        </h2>
        {comments.length > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-400">
            {comments.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 py-4 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Cargando...</span>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-zinc-500 font-mono py-2">Todo al día, sin comentarios pendientes.</p>
      ) : (
        <div className="space-y-2">
          {comments.slice(0, 3).map((c) => (
            <div key={c._id} className="flex items-start gap-2 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-zinc-300 font-medium truncate">{c.name}</p>
                <p className="text-zinc-500 line-clamp-1">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/comments?status=unverified"
        className="block text-center text-xs text-indigo-400 hover:text-indigo-300 font-medium pt-1"
      >
        Ver todos &rarr;
      </Link>
    </div>
  );
}
