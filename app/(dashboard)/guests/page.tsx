'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, Trash2, Edit2, Loader2, Globe, Share2 } from 'lucide-react';

export default function GuestsListPage() {
  const [guests, setGuests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchGuests = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guests?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setGuests(data);
      }
    } catch (err) {
      console.error('Error fetching guests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests(search);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar este invitado?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/guests/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGuests((prev) => prev.filter((g) => g._id !== id));
      }
    } catch (err) {
      alert('Error al eliminar invitado');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <span>Gestión de Invitados</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Perfiles de colaboradores, alumnos y ponentes del podcast
          </p>
        </div>

        <Link
          href="/guests/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Invitado</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar invitado por nombre, rol o slug..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
        />
      </div>

      {/* Grid of Guests */}
      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          <span className="text-xs font-mono">Cargando invitados...</span>
        </div>
      ) : guests.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center space-y-3">
          <p className="text-xs font-mono text-zinc-500">No se encontraron invitados.</p>
          <Link
            href="/guests/new"
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primer invitado</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guests.map((guest) => (
            <div
              key={guest._id}
              className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start gap-3">
                {guest.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={guest.image}
                    alt={guest.name}
                    className="w-12 h-12 rounded-full object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold shrink-0">
                    {guest.name?.charAt(0)}
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">{guest.name}</h3>
                  <p className="text-xs text-purple-400 font-mono truncate">{guest.role || 'Invitado'}</p>
                  <p className="text-[11px] text-zinc-500 font-mono truncate">Slug: {guest.slug}</p>
                </div>
              </div>

              {guest.description && (
                <p className="text-xs text-zinc-400 line-clamp-2">{guest.description}</p>
              )}

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-500">
                  {guest.social?.twitter && <span title={guest.social.twitter}><Share2 className="w-3.5 h-3.5" /></span>}
                  {guest.social?.instagram && <span title={guest.social.instagram}><Share2 className="w-3.5 h-3.5" /></span>}
                  {guest.social?.website && <span title={guest.social.website}><Globe className="w-3.5 h-3.5" /></span>}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/guests/${guest._id}`}
                    className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-md text-xs font-medium transition"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Editar</span>
                  </Link>

                  <button
                    onClick={() => handleDelete(guest._id)}
                    disabled={deletingId === guest._id}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition"
                    title="Eliminar invitado"
                  >
                    {deletingId === guest._id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
