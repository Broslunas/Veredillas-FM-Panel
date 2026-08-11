'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw, Loader2, Radio, FileText, UserCheck, Users } from 'lucide-react';

interface TrashItem {
  collection: 'episodes' | 'blog' | 'guests' | 'team';
  id: string;
  title: string;
  slug?: string;
  image?: string | null;
  deletedAt: string;
}

const TABS: { value: TrashItem['collection'] | 'all'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'Todos', icon: Trash2 },
  { value: 'episodes', label: 'Episodios', icon: Radio },
  { value: 'blog', label: 'Blog', icon: FileText },
  { value: 'guests', label: 'Invitados', icon: UserCheck },
  { value: 'team', label: 'Equipo', icon: Users },
];

const COLLECTION_LABEL: Record<TrashItem['collection'], string> = {
  episodes: 'Episodio',
  blog: 'Blog',
  guests: 'Invitado',
  team: 'Equipo',
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

export default function TrashPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TrashItem['collection'] | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canPurge, setCanPurge] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trash');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching trash:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        setCanPurge(role === 'admin' || role === 'owner');
      })
      .catch(() => {});
  }, []);

  const handleRestore = async (item: TrashItem) => {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/trash/${item.collection}/${item.id}`, { method: 'POST' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        alert('Error al restaurar el elemento');
      }
    } catch {
      alert('Error al restaurar el elemento');
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (item: TrashItem) => {
    if (
      !confirm(
        `¿Eliminar «${item.title}» definitivamente? Esta acción NO se puede deshacer.`
      )
    )
      return;

    setBusyId(item.id);
    try {
      const res = await fetch(`/api/trash/${item.collection}/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        alert('Error al eliminar el elemento definitivamente');
      }
    } catch {
      alert('Error al eliminar el elemento definitivamente');
    } finally {
      setBusyId(null);
    }
  };

  const filteredItems = activeTab === 'all' ? items : items.filter((i) => i.collection === activeTab);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-zinc-400" />
          <span>Papelera</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">
          Episodios, blog, invitados y equipo movidos a la papelera. Puedes restaurarlos o eliminarlos definitivamente.
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.value === 'all' ? items.length : items.filter((i) => i.collection === tab.value).length;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === tab.value
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span className="text-[10px] font-mono text-zinc-500">{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-mono">Cargando papelera...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center">
          <p className="text-xs font-mono text-zinc-500">La papelera está vacía.</p>
        </div>
      ) : (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl divide-y divide-zinc-800/60 overflow-hidden">
          {filteredItems.map((item) => (
            <div
              key={`${item.collection}-${item.id}`}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/80 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-10 h-10 rounded-lg object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{item.title}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">
                      {COLLECTION_LABEL[item.collection]}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">Eliminado {timeAgo(item.deletedAt)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => handleRestore(item)}
                  disabled={busyId === item.id}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                >
                  {busyId === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Restaurar</span>
                </button>

                {canPurge && (
                  <button
                    onClick={() => handlePurge(item)}
                    disabled={busyId === item.id}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition disabled:opacity-50"
                    title="Eliminar definitivamente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
