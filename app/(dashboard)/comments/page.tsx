'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Star,
  Paperclip,
  X,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ThumbsUp,
  Image as ImageIcon
} from 'lucide-react';

interface CommentItem {
  _id: string;
  slug: string;
  name: string;
  email: string;
  text?: string;
  createdAt: string;
  isVerified: boolean;
  rating: number;
  likes?: string[];
  attachments?: string[];
  parentId?: string;
}

export default function CommentsModerationPage() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Modals state
  const [selectedForPreview, setSelectedForPreview] = useState<CommentItem | null>(null);
  const [selectedForEdit, setSelectedForEdit] = useState<CommentItem | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<CommentItem | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(0);
  const [saving, setSaving] = useState(false);

  // Selection & Bulk state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchComments = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/comments');
      if (res.ok) {
        const json = await res.json();
        setComments(json.comments || []);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Deep-link support: /comments?status=unverified pre-filters the view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'verified' || status === 'unverified') {
      setStatusFilter(status);
    }
  }, []);

  // Metrics
  const totalComments = comments.length;
  const verifiedCount = useMemo(() => comments.filter((c) => c.isVerified).length, [comments]);
  const pendingCount = totalComments - verifiedCount;
  const avgRating = useMemo(() => {
    const rated = comments.filter((c) => (c.rating || 0) > 0);
    if (rated.length === 0) return 0;
    const sum = rated.reduce((acc, c) => acc + c.rating, 0);
    return Math.round((sum / rated.length) * 10) / 10;
  }, [comments]);

  const attachmentsCount = useMemo(
    () => comments.filter((c) => c.attachments && c.attachments.length > 0).length,
    [comments]
  );

  // Filtering & Sorting
  const filteredComments = useMemo(() => {
    return comments
      .filter((c) => {
        const query = search.trim().toLowerCase();
        if (query) {
          const matchName = c.name?.toLowerCase().includes(query);
          const matchEmail = c.email?.toLowerCase().includes(query);
          const matchText = c.text?.toLowerCase().includes(query);
          const matchSlug = c.slug?.toLowerCase().includes(query);
          if (!matchName && !matchEmail && !matchText && !matchSlug) return false;
        }
        if (statusFilter === 'verified' && !c.isVerified) return false;
        if (statusFilter === 'unverified' && c.isVerified) return false;
        if (ratingFilter !== 'all') {
          const rNum = parseInt(ratingFilter, 10);
          if (c.rating !== rNum) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
      });
  }, [comments, search, statusFilter, ratingFilter, sortBy]);

  // Handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredComments.map((c) => c._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleToggleVerify = async (comment: CommentItem) => {
    setActionError(null);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: comment._id,
          isVerified: !comment.isVerified,
        }),
      });

      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c._id === comment._id ? { ...c, isVerified: !c.isVerified } : c))
        );
      } else {
        setActionError('Error al actualizar verificación');
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red al verificar');
    }
  };

  const openEditModal = (c: CommentItem) => {
    setSelectedForEdit(c);
    setEditName(c.name || '');
    setEditEmail(c.email || '');
    setEditText(c.text || '');
    setEditRating(c.rating || 0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForEdit) return;
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedForEdit._id,
          name: editName,
          email: editEmail,
          text: editText,
          rating: editRating,
        }),
      });

      if (res.ok) {
        setSelectedForEdit(null);
        fetchComments(true);
      } else {
        setActionError('Error al guardar cambios');
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red al editar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!commentToDelete) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/comments?id=${commentToDelete._id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c._id !== commentToDelete._id));
        setSelectedIds((prev) => prev.filter((id) => id !== commentToDelete._id));
        setCommentToDelete(null);
      } else {
        setActionError('No se pudo eliminar el comentario');
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red al eliminar');
    }
  };

  const handleBulkVerify = async (verifyStatus: boolean) => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    setActionError(null);
    try {
      for (const id of selectedIds) {
        await fetch('/api/admin/comments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isVerified: verifyStatus }),
        });
      }
      setSelectedIds([]);
      fetchComments(true);
    } catch (err) {
      console.error(err);
      setActionError('Error en verificación masiva');
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkOperating(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        setShowBulkDeleteConfirm(false);
        fetchComments(true);
      } else {
        setActionError('Error al eliminar comentarios en masa');
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red');
    } finally {
      setIsBulkOperating(false);
    }
  };

  function formatTimeAgo(dateStr: string): string {
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'ahora';
    const m = Math.floor(seconds / 60);
    if (m < 60) return `hace ${m}m`;
    const h = Math.floor(seconds / 3600);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(seconds / 86400);
    return `hace ${d}d`;
  }

  if (loading && comments.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando moderación de comentarios...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
            <span>Moderación de Comentarios</span>
            <MessageSquare className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de opiniones, reseñas y aportaciones de la comunidad de Veredillas FM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchComments()}
            disabled={refreshing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Total */}
        <div className="bg-zinc-900/70 border border-indigo-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Total Comentarios</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{totalComments}</div>
          <div className="text-[10px] text-indigo-400 font-medium">Aportaciones totales</div>
        </div>

        {/* Verificados */}
        <div className="bg-zinc-900/70 border border-emerald-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Verificados (Ok)</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{verifiedCount}</div>
          <div className="text-[10px] text-emerald-400 font-medium">
            {totalComments > 0 ? Math.round((verifiedCount / totalComments) * 100) : 0}% aprobados
          </div>
        </div>

        {/* Pendientes */}
        <div className="bg-zinc-900/70 border border-amber-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Pendientes (Wait)</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{pendingCount}</div>
          <div className="text-[10px] text-amber-400 font-medium">Requieren revisión</div>
        </div>

        {/* Rating Promedio */}
        <div className="bg-zinc-900/70 border border-purple-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Valoración Media</span>
          <div className="text-2xl font-black text-zinc-100 font-mono flex items-center gap-1.5">
            <span>{avgRating}</span>
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-[10px] text-purple-400 font-medium">Puntuación media estrellas</div>
        </div>

        {/* Con Adjuntos */}
        <div className="bg-zinc-900/70 border border-sky-900/40 rounded-xl p-4 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Con Adjuntos</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{attachmentsCount}</div>
          <div className="text-[10px] text-sky-400 font-medium">GIFs / Archivos</div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar autor, email, contenido o episodio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="all">Estado: Todos</option>
            <option value="verified">Verificados (Ok)</option>
            <option value="unverified">Pendientes (Wait)</option>
          </select>

          {/* Rating Filter */}
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="all">Rating: Todos</option>
            <option value="5">5 Estrellas ★★★★★</option>
            <option value="4">4 Estrellas ★★★★☆</option>
            <option value="3">3 Estrellas ★★★☆☆</option>
            <option value="2">2 Estrellas ★★☆☆☆</option>
            <option value="1">1 Estrella ★☆☆☆☆</option>
            <option value="0">Sin estrellas</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="rating">Mejor valorados</option>
            <option value="name">Autor A-Z</option>
          </select>
        </div>

        <div className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/80 px-2.5 py-1 rounded-lg shrink-0 text-center">
          <span className="font-bold text-zinc-100">{filteredComments.length}</span> resultados
        </div>
      </div>

      {/* ── BULK ACTIONS BAR ── */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-800 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold bg-indigo-600 text-white px-2 py-0.5 rounded text-[11px]">
              {selectedIds.length}
            </span>
            <span className="text-indigo-200">comentarios seleccionados</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBulkVerify(true)}
              disabled={isBulkOperating}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verificar Todos</span>
            </button>

            <button
              onClick={() => handleBulkVerify(false)}
              disabled={isBulkOperating}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Marcar Pendientes</span>
            </button>

            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={isBulkOperating}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Selección</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-indigo-300 hover:text-white px-2 py-1 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── COMMENTS TABLE ── */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl">
        {filteredComments.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-300">No se encontraron comentarios</p>
            <p className="text-xs font-mono text-zinc-500">Ajusta los filtros de búsqueda para ver más resultados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800/80 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredComments.length}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600"
                    />
                  </th>
                  <th className="p-3.5 w-1/4">Autor</th>
                  <th className="p-3.5 w-1/6">Episodio</th>
                  <th className="p-3.5">Comentario</th>
                  <th className="p-3.5 text-center hidden md:table-cell">Enviado</th>
                  <th className="p-3.5 text-center">Estado</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/60">
                {filteredComments.map((c) => {
                  const isSelected = selectedIds.includes(c._id);
                  return (
                    <tr
                      key={c._id}
                      className={`hover:bg-zinc-800/40 transition ${isSelected ? 'bg-indigo-950/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c._id)}
                          className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600"
                        />
                      </td>

                      {/* Author */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{c.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate">{c.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Episode */}
                      <td className="p-3.5 font-mono text-[11px]">
                        <span
                          className="text-indigo-400 hover:text-indigo-300 truncate max-w-[140px] block font-semibold"
                          title={c.slug}
                        >
                          {c.slug}
                        </span>
                      </td>

                      {/* Comment text + rating + attachments */}
                      <td className="p-3.5">
                        <div className="space-y-1.5 max-w-xl">
                          <p className="text-zinc-300 italic text-xs leading-relaxed line-clamp-2">
                            &ldquo;{c.text || <span className="not-italic text-zinc-600">Sin texto</span>}&rdquo;
                          </p>

                          <div className="flex items-center gap-2 flex-wrap">
                            {c.rating > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-[10px] font-mono text-amber-400">
                                <Star className="w-3 h-3 fill-amber-400" />
                                <span className="font-bold">{c.rating}/5</span>
                              </span>
                            )}

                            {c.attachments && c.attachments.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/80 text-[10px] font-mono text-sky-400 uppercase font-semibold">
                                <Paperclip className="w-3 h-3" />
                                <span>{c.attachments.length} adjuntos</span>
                              </span>
                            )}

                            {c.likes && c.likes.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
                                <ThumbsUp className="w-3 h-3" /> {c.likes.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-center hidden md:table-cell font-mono text-zinc-400 text-[11px]">
                        {formatTimeAgo(c.createdAt)}
                      </td>

                      {/* Verification Status */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                            c.isVerified
                              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400'
                              : 'bg-amber-950/80 border-amber-800 text-amber-400'
                          }`}
                        >
                          {c.isVerified ? 'Ok' : 'Wait'}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedForPreview(c)}
                            className="p-1.5 text-sky-400 hover:text-sky-200 hover:bg-sky-950 rounded transition"
                            title="Vista previa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(c)}
                            className="p-1.5 text-amber-400 hover:text-amber-200 hover:bg-amber-950 rounded transition"
                            title="Editar comentario"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleVerify(c)}
                            className={`p-1.5 rounded transition ${
                              c.isVerified
                                ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                                : 'text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950'
                            }`}
                            title={c.isVerified ? 'Marcar pendiente' : 'Verificar'}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCommentToDelete(c)}
                            className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950 rounded transition"
                            title="Eliminar comentario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── PREVIEW MODAL ── */}
      {selectedForPreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedForPreview(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-3">
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                Simulación Visual Veredillas FM
              </span>
              <h3 className="text-base font-bold text-zinc-100">Vista Previa de Comentario</h3>
            </div>

            {/* Simulated Comment Card */}
            <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-md">
                  {selectedForPreview.name?.charAt(0)?.toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-zinc-100 text-sm">{selectedForPreview.name}</h4>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {formatTimeAgo(selectedForPreview.createdAt)}
                    </span>
                  </div>

                  {selectedForPreview.rating > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= selectedForPreview.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                {selectedForPreview.text || <span className="text-zinc-600 italic">Sin texto</span>}
              </p>

              {selectedForPreview.attachments && selectedForPreview.attachments.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {selectedForPreview.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 flex items-center gap-2 overflow-hidden"
                    >
                      <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-[10px] font-mono text-zinc-400 truncate">{att}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setSelectedForPreview(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {selectedForEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedForEdit(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Edit className="w-4 h-4 text-amber-400" /> Modificar Comentario
              </h3>
              <p className="text-xs text-zinc-500 font-mono">ID: {selectedForEdit._id}</p>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Valoración (Estrellas)</label>
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(star)}
                      className={`p-1 rounded transition ${
                        editRating >= star && star > 0
                          ? 'text-amber-400'
                          : star === 0
                          ? 'text-zinc-500 text-[10px] font-mono'
                          : 'text-zinc-700'
                      }`}
                    >
                      {star === 0 ? 'Sin estrellas' : <Star className="w-5 h-5 fill-current" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Contenido del Comentario</label>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedForEdit(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition shadow-lg shadow-amber-600/20"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE SINGLE CONFIRM MODAL ── */}
      {commentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-100">¿Eliminar comentario?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Esta acción eliminará el comentario de <strong className="text-zinc-200">{commentToDelete.name}</strong> de forma permanente.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setCommentToDelete(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSingle}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition shadow-lg shadow-rose-600/20"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK DELETE CONFIRM MODAL ── */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-100">¿Eliminar {selectedIds.length} comentarios?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Se borrarán permanentemente los comentarios seleccionados. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkOperating}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition shadow-lg shadow-rose-600/20"
              >
                {isBulkOperating ? 'Eliminando...' : 'Sí, Eliminar Todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
