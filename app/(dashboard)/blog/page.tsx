'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Trash2, Edit2, Loader2 } from 'lucide-react';

export default function BlogListPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPosts = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/blog?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Error fetching blog posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(search);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta publicación del blog?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/blog/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p._id !== id));
      }
    } catch (err) {
      alert('Error al eliminar la publicación');
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
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>Gestión de Blog</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Publicaciones, noticias y artículos editoriales
          </p>
        </div>

        <Link
          href="/blog/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2.5 rounded-lg transition flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Artículo</span>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar artículo por título, slug o descripción..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition"
        />
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="text-xs font-mono">Cargando artículos...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center space-y-3">
          <p className="text-xs font-mono text-zinc-500">No se encontraron artículos.</p>
          <Link
            href="/blog/new"
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primer artículo</span>
          </Link>
        </div>
      ) : (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl divide-y divide-zinc-800/60 overflow-hidden">
          {posts.map((post) => (
            <div
              key={post._id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/80 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                {post.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-12 h-12 rounded-lg object-cover bg-zinc-950 border border-zinc-800 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">{post.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-1">{post.description}</p>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500">
                    <span>Autor: {post.author || 'Redacción Veredillas'}</span>
                    <span>&bull;</span>
                    <span>{post.pubDate ? new Date(post.pubDate).toLocaleDateString('es-ES') : ''}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Link
                  href={`/blog/${post._id}`}
                  className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </Link>

                <button
                  onClick={() => handleDelete(post._id)}
                  disabled={deletingId === post._id}
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                  title="Eliminar artículo"
                >
                  {deletingId === post._id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
