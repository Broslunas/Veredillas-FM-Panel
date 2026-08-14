'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Images, Trash2, Edit2, Loader2, Star, Video, ImageIcon } from 'lucide-react';

export default function GalleryListPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gallery?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching gallery categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories(search);
  }, [search]);

  const totalImages = useMemo(
    () => categories.reduce((sum, cat) => sum + (cat.images?.length || 0), 0),
    [categories]
  );

  const handleDelete = async (id: string, category: string) => {
    if (!confirm(`¿Eliminar la categoría "${category}" y todos sus elementos? Esta acción no se puede deshacer.`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c._id !== id));
      }
    } catch (err) {
      alert('Error al eliminar la categoría de galería');
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
            <Images className="w-5 h-5 text-purple-400" />
            <span>Gestión de Galería</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {categories.length} categoría{categories.length === 1 ? '' : 's'} · {totalImages} elemento
            {totalImages === 1 ? '' : 's'} en total
          </p>
        </div>

        <Link
          href="/gallery/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Categoría</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por categoría o slug..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
        />
      </div>

      {/* Grid of Categories */}
      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          <span className="text-xs font-mono">Cargando galería...</span>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center space-y-3">
          <p className="text-xs font-mono text-zinc-500">No se encontraron categorías de galería.</p>
          <Link
            href="/gallery/new"
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primera categoría</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const cover = cat.images?.find((img: any) => img.featured) || cat.images?.[0];
            const featuredCount = cat.images?.filter((img: any) => img.featured).length || 0;
            const videoCount = cat.images?.filter((img: any) => img.type === 'video').length || 0;

            return (
              <div
                key={cat._id}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden hover:border-zinc-700/80 transition flex flex-col"
              >
                <div className="relative h-32 bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-center overflow-hidden">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover.thumbnail || cover.src}
                      alt={cover.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-zinc-700" />
                  )}
                </div>

                <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate">{cat.category}</h3>
                    <p className="text-[11px] text-zinc-500 font-mono truncate">Slug: {cat.slug}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/50 text-indigo-300 border border-indigo-900/50">
                      {cat.images?.length || 0} elemento{(cat.images?.length || 0) === 1 ? '' : 's'}
                    </span>
                    {featuredCount > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-900/50 flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {featuredCount}
                      </span>
                    )}
                    {videoCount > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {videoCount}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-end gap-2">
                    <Link
                      href={`/gallery/${cat._id}`}
                      className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-md text-xs font-medium transition"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Editar</span>
                    </Link>

                    <button
                      onClick={() => handleDelete(cat._id, cat.category)}
                      disabled={deletingId === cat._id}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition"
                      title="Eliminar categoría de galería"
                    >
                      {deletingId === cat._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
