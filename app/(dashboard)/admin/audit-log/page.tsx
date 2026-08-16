'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  History,
  Loader2,
  ShieldAlert,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  ShieldCheck,
  Flame,
} from 'lucide-react';

interface AuditLogEntry {
  _id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  label?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  create: { label: 'Creado', className: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400', icon: Plus },
  update: { label: 'Actualizado', className: 'bg-indigo-950/60 border-indigo-800/60 text-indigo-400', icon: Pencil },
  delete: { label: 'Enviado a papelera', className: 'bg-amber-950/60 border-amber-800/60 text-amber-400', icon: Trash2 },
  restore: { label: 'Restaurado', className: 'bg-sky-950/60 border-sky-800/60 text-sky-400', icon: RotateCcw },
  permanent_delete: {
    label: 'Eliminado definitivamente',
    className: 'bg-red-950/60 border-red-800/60 text-red-400',
    icon: Flame,
  },
  role_change: { label: 'Cambio de rol', className: 'bg-purple-950/60 border-purple-800/60 text-purple-400', icon: ShieldCheck },
};

const RESOURCE_LABELS: Record<string, string> = {
  episode: 'Episodio',
  blog: 'Blog',
  gallery: 'Galería',
  guest: 'Invitado',
  team: 'Equipo',
  user: 'Usuario',
  comment: 'Comentario',
  interview: 'Entrevista',
  bucket: 'Bucket R2',
};

const ACTIONS = Object.keys(ACTION_META);

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(vacío)';
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function AuditLogPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [resources, setResources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [resourceFilter, setResourceFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json().catch(() => null);
        const role = data?.user?.role;
        setAuthorized(res.ok && !!data?.user && (role === 'admin' || role === 'owner'));
      } catch {
        setAuthorized(false);
      } finally {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (resourceFilter !== 'all') params.set('resource', resourceFilter);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (search.trim()) params.set('q', search.trim());
      params.set('page', String(page));

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setResources(data.resources || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [resourceFilter, actionFilter, search, page]);

  useEffect(() => {
    if (authorized) load();
  }, [authorized, load]);

  useEffect(() => {
    setPage(1);
  }, [resourceFilter, actionFilter, search]);

  if (!authChecked) {
    return (
      <div className="p-8 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <ShieldAlert className="w-10 h-10 text-amber-400" />
        <p>Solo los administradores y propietarios pueden ver el registro de auditoría.</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-400" />
          <span>Registro de Auditoría</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Quién ha creado, editado, eliminado o restaurado contenido y usuarios en el panel.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por persona o elemento..."
            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
        >
          <option value="all">Todos los tipos</option>
          {resources.map((r) => (
            <option key={r} value={r}>
              {RESOURCE_LABELS[r] || r}
            </option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
        >
          <option value="all">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a].label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-mono">Cargando registro...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center">
          <p className="text-xs font-mono text-zinc-500">No hay eventos que coincidan con los filtros.</p>
        </div>
      ) : (
        <>
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl divide-y divide-zinc-800/60 overflow-hidden">
            {logs.map((entry) => {
              const meta = ACTION_META[entry.action] || ACTION_META.update;
              const Icon = meta.icon;
              const isExpanded = expandedId === entry._id;
              const hasDetails =
                (entry.changes && Object.keys(entry.changes).length > 0) ||
                (entry.metadata && Object.keys(entry.metadata).length > 0);

              return (
                <div key={entry._id} className="hover:bg-zinc-900/80 transition">
                  <button
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry._id)}
                    className={`w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
                      hasDetails ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${meta.className}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-zinc-100 truncate">
                            {entry.label || entry.resourceId || 'Sin título'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">
                            {RESOURCE_LABELS[entry.resource] || entry.resource}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 font-mono truncate">
                          {meta.label} por {entry.actorName} ({entry.actorRole}) &bull; {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>

                    {hasDetails && (
                      <ChevronDown
                        className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="px-4 pb-4 -mt-1">
                      <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-lg p-3 space-y-1.5">
                        {entry.changes &&
                          Object.entries(entry.changes).map(([field, diff]) => (
                            <div key={field} className="text-xs font-mono flex flex-wrap gap-1.5">
                              <span className="text-zinc-500">{field}:</span>
                              <span className="text-red-400/80 line-through decoration-red-700/60">
                                {formatValue(diff.before)}
                              </span>
                              <span className="text-zinc-600">&rarr;</span>
                              <span className="text-emerald-400">{formatValue(diff.after)}</span>
                            </div>
                          ))}
                        {entry.metadata &&
                          Object.entries(entry.metadata).map(([key, value]) => (
                            <div key={key} className="text-xs font-mono flex gap-1.5">
                              <span className="text-zinc-500">{key}:</span>
                              <span className="text-zinc-300">{formatValue(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
            <span>{total} evento(s)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>
                Página {page} de {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-zinc-100 disabled:opacity-40 disabled:hover:text-zinc-400 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
