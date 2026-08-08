'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Zap,
  FileText,
  RefreshCw,
  Search,
  Copy,
  Check,
  Trash2,
  Edit,
  Eye,
  Send,
  Download,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Flag,
  User,
  Mail,
  Phone,
  Link as LinkIcon,
  Sparkles
} from 'lucide-react';

interface InterviewItem {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  description?: string;
  preferredDate?: string;
  token?: string;
  status: 'pending' | 'invited' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface RegisteredUser {
  _id: string;
  name: string;
  email: string;
  picture?: string;
}

type ColumnKey = 'pending' | 'invited' | 'approved' | 'completed' | 'rejected';

const KANBAN_COLUMNS: { key: ColumnKey; title: string; color: string; border: string; bg: string; icon: any }[] = [
  { key: 'pending', title: 'Pendientes', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-950/20', icon: Clock },
  { key: 'invited', title: 'Invitados', color: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-950/20', icon: Mail },
  { key: 'approved', title: 'Aprobadas', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/20', icon: CheckCircle2 },
  { key: 'completed', title: 'Completadas', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-950/20', icon: Flag },
  { key: 'rejected', title: 'Rechazadas', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-950/20', icon: XCircle },
];

const DOC_TEMPLATES = [
  {
    type: 'menores-14',
    title: 'Menores 14 años',
    subtitle: 'Autorización Alumnos',
    icon: '👶',
    url: 'https://cdn.veredillasfm.es/docs/Veredillas-FM-autorizaci%C3%B3n-menores-14-a%C3%B1os.pdf',
  },
  {
    type: 'mayores-14',
    title: 'Mayores 14 años',
    subtitle: 'Autorización Alumnos',
    icon: '🧑‍🎓',
    url: 'https://cdn.veredillasfm.es/docs/Veredillas-FM-autorizaci%C3%B3n-mayores-14-a%C3%B1os.pdf',
  },
  {
    type: 'docentes',
    title: 'Docentes',
    subtitle: 'Autorización Profesorado',
    icon: '👩‍🏫',
    url: 'https://cdn.veredillasfm.es/docs/Veredillas-FM-autorizaci%C3%B3n-docentes.pdf',
  },
  {
    type: 'externos',
    title: 'Externos',
    subtitle: 'Autorización Invitados',
    icon: '🌍',
    url: 'https://cdn.veredillasfm.es/docs/Veredillas-FM-autorizaci%C3%B3n-externos.pdf',
  },
];

export default function InterviewsBoardPage() {
  const [requests, setRequests] = useState<InterviewItem[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedForDetails, setSelectedForDetails] = useState<InterviewItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InterviewItem | null>(null);

  // Create/Edit Form state
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<ColumnKey>('invited');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Docs Form state
  const [docRecipientName, setDocRecipientName] = useState('');
  const [docRecipientEmail, setDocRecipientEmail] = useState('');
  const [sendingDocType, setSendingDocType] = useState<string | null>(null);

  // Feedback alerts
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchInterviews = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/interviews');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setRegisteredUsers(data.registeredUsers || []);
      }
    } catch (err) {
      console.error('Error fetching interviews:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  // Group requests by Status Column
  const columnsData = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = requests.filter((r) => {
      if (!query) return true;
      return (
        r.name?.toLowerCase().includes(query) ||
        r.email?.toLowerCase().includes(query) ||
        r.topic?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
      );
    });

    const grouped: Record<ColumnKey, InterviewItem[]> = {
      pending: [],
      invited: [],
      approved: [],
      completed: [],
      rejected: [],
    };

    filtered.forEach((r) => {
      if (grouped[r.status]) {
        grouped[r.status].push(r);
      }
    });

    return grouped;
  }, [requests, search]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: ColumnKey) => {
    e.preventDefault();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    // Optimistic UI update
    setRequests((prev) =>
      prev.map((r) => (r._id === cardId ? { ...r, status: newStatus } : r))
    );
    setDraggedCardId(null);

    try {
      const res = await fetch('/api/admin/interviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cardId, status: newStatus }),
      });

      if (res.ok) {
        showToast('Estado actualizado', 'success');
      } else {
        showToast('Error al actualizar estado', 'error');
        fetchInterviews(true); // Revert on failure
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión', 'error');
      fetchInterviews(true);
    }
  };

  // Create/Edit Handler
  const handleUserSelect = (email: string) => {
    setSelectedUserEmail(email);
    const user = registeredUsers.find((u) => u.email === email);
    if (user) {
      setFormName(user.name);
      setFormEmail(user.email);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setSelectedUserEmail('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormTopic('');
    setFormDate('');
    setFormDesc('');
    setFormStatus('invited');
    setShowCreateModal(true);
  };

  const openEditModal = (item: InterviewItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item._id);
    setFormName(item.name || '');
    setFormEmail(item.email || '');
    setFormPhone(item.phone || '');
    setFormTopic(item.topic || '');
    setFormDate(item.preferredDate ? new Date(item.preferredDate).toISOString().slice(0, 16) : '');
    setFormDesc(item.description || '');
    setFormStatus(item.status);
    setShowCreateModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formEmail || !formTopic) return;
    setCreating(true);

    try {
      const payload = {
        id: editingId,
        name: formName,
        email: formEmail,
        phone: formPhone,
        topic: formTopic,
        description: formDesc,
        preferredDate: formDate ? formDate : undefined,
        status: formStatus,
      };

      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch('/api/admin/interviews', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        showToast(editingId ? 'Invitación actualizada' : 'Invitación creada', 'success');
        setShowCreateModal(false);
        fetchInterviews(true);
      } else {
        const errJson = await res.json();
        showToast(errJson.error || 'Error al procesar solicitud', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Delete Handler
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/admin/interviews?id=${itemToDelete._id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r._id !== itemToDelete._id));
        showToast('Solicitud eliminada', 'success');
        setItemToDelete(null);
      } else {
        showToast('Error al eliminar entrevista', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de red', 'error');
    }
  };

  // Copy Link Helper
  const copyInviteLink = (token?: string, email?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!token) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.veredillasfm.es';
    const url = `${origin}/entrevistas?token=${token}&email=${encodeURIComponent(email || '')}`;
    navigator.clipboard.writeText(url);
    setCopiedId(token);
    showToast('Enlace copiado al portapapeles', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Open Docs Modal
  const openDocsModal = (name = '', email = '', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDocRecipientName(name);
    setDocRecipientEmail(email);
    setShowDocsModal(true);
  };

  // Send Authorization Document via n8n
  const handleSendAuthorization = async (docType: string, docUrl: string) => {
    if (!docRecipientName || !docRecipientEmail) {
      showToast('Indica nombre y email del destinatario', 'error');
      return;
    }

    setSendingDocType(docType);
    try {
      const res = await fetch('/api/admin/send-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: docRecipientName,
          email: docRecipientEmail,
          docType,
          docUrl,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showToast('Autorización enviada correctamente por email', 'success');
      } else {
        showToast(json.error || 'Error al enviar la autorización', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error de conexión', 'error');
    } finally {
      setSendingDocType(null);
    }
  };

  function formatDateShort(dateStr?: string): string {
    if (!dateStr) return 'Sin fecha';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Sin fecha';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  if (loading && requests.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando tablero de entrevistas...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto w-full">
      {/* ── Toast Alert ── */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-2xl text-xs font-medium flex items-center gap-2 animate-in slide-in-from-bottom-5 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 border-emerald-800 text-emerald-200'
              : 'bg-rose-950 border-rose-800 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
            <span>Tablero de Entrevistas</span>
            <Calendar className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gestión de flujo de invitados, tokens de confirmación y centro de autorizaciones.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Invitación</span>
          </button>

          <a
            href="https://n8n.broslunas.com/workflow/kozHuKfSLnb6rPmE_kEy9"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Ver en n8n</span>
          </a>

          <button
            onClick={() => openDocsModal()}
            className="bg-purple-950/60 border border-purple-800/80 hover:bg-purple-900/60 text-purple-300 px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>Autorizaciones</span>
          </button>

          <button
            onClick={() => fetchInterviews()}
            disabled={refreshing}
            className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── SEARCH & FILTER ── */}
      <div className="flex items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por invitado, correo o tema..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="text-xs font-mono text-zinc-400">
          Total de solicitudes: <span className="font-bold text-zinc-100">{requests.length}</span>
        </div>
      </div>

      {/* ── KANBAN BOARD ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const Icon = col.icon;
          const items = columnsData[col.key] || [];

          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              className={`bg-zinc-900/60 border ${col.border} rounded-2xl p-3 space-y-3 min-h-[500px] flex flex-col`}
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between p-2 rounded-xl ${col.bg} border ${col.border}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${col.color}`} />
                  <span className={`text-xs font-bold ${col.color}`}>{col.title}</span>
                </div>
                <span className="text-[11px] font-mono font-bold bg-zinc-950/80 px-2 py-0.5 rounded text-zinc-300 border border-zinc-800">
                  {items.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-600 text-xs font-mono">
                    Arrastra aquí
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item._id)}
                      onClick={() => setSelectedForDetails(item)}
                      className="bg-zinc-950/80 border border-zinc-800 hover:border-indigo-500/60 p-4 rounded-xl space-y-3 cursor-grab active:cursor-grabbing hover:shadow-xl transition-all group relative"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-1 flex-wrap text-[10px] font-mono">
                        <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-500" />
                          <span>{formatDateShort(item.preferredDate)}</span>
                        </span>

                        {item.status === 'invited' && item.token && (
                          <span className="bg-sky-950/80 border border-sky-800 text-sky-300 px-2 py-0.5 rounded font-semibold">
                            Token Activo
                          </span>
                        )}
                      </div>

                      {/* Topic Title */}
                      <h4 className="font-bold text-zinc-100 text-xs leading-snug line-clamp-2">
                        {item.topic}
                      </h4>

                      {/* User Info */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {item.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="text-xs text-zinc-400 truncate">{item.name}</span>
                      </div>

                      {/* Card Hover Actions */}
                      <div className="pt-2 border-t border-zinc-900 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition">
                        {item.token && (
                          <button
                            onClick={(e) => copyInviteLink(item.token, item.email, e)}
                            className="p-1.5 text-sky-400 hover:text-sky-200 hover:bg-sky-950/60 rounded transition"
                            title="Copiar Enlace de Invitación"
                          >
                            {copiedId === item.token ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        <button
                          onClick={(e) => openDocsModal(item.name, item.email, e)}
                          className="p-1.5 text-purple-400 hover:text-purple-200 hover:bg-purple-950/60 rounded transition"
                          title="Enviar Documentos de Autorización"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => openEditModal(item, e)}
                          className="p-1.5 text-amber-400 hover:text-amber-200 hover:bg-amber-950/60 rounded transition"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToDelete(item);
                          }}
                          className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CREATE / EDIT MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>{editingId ? 'Modificar Invitación' : 'Nueva Invitación de Entrevista'}</span>
              </h3>
              <p className="text-xs text-zinc-500">
                {editingId ? 'Actualiza los datos de la entrevista.' : 'Envía o registra una propuesta de grabación para Veredillas FM.'}
              </p>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3.5 text-xs">
              {/* Select Registered User */}
              {!editingId && registeredUsers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Cargar Usuario Registrado (Opcional)</label>
                  <select
                    value={selectedUserEmail}
                    onChange={(e) => handleUserSelect(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  >
                    <option value="">-- Escribir manualmente --</option>
                    {registeredUsers.map((u) => (
                      <option key={u._id} value={u.email}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Nombre del Invitado *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="Ej: Juan Pérez"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Correo Electrónico *</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    placeholder="juan@ejemplo.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Teléfono (Opcional)</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+34 600..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Estado inicial</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as ColumnKey)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="invited">📩 Invitado (Token Activo)</option>
                    <option value="pending">⏳ Pendiente</option>
                    <option value="approved">✅ Aprobado</option>
                    <option value="completed">🏁 Completado</option>
                    <option value="rejected">❌ Rechazado</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Tema de la Entrevista *</label>
                <input
                  type="text"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  required
                  placeholder="Ej: Inteligencia Artificial en la Educación"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Fecha y Hora Propuesta (Opcional)</label>
                <input
                  type="datetime-local"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Notas / Descripción</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={3}
                  placeholder="Detalles adicionales, equipamiento o guion..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg font-medium transition shadow-lg shadow-indigo-600/20"
                >
                  {creating ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Invitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DETAILS MODAL ── */}
      {selectedForDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedForDetails(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-3">
              <span className="text-[10px] font-mono text-indigo-400 uppercase font-bold">
                Detalles de Entrevista
              </span>
              <h3 className="text-base font-bold text-zinc-100 leading-snug mt-0.5">
                {selectedForDetails.topic}
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-500 shrink-0" />
                <span><strong>Invitado:</strong> {selectedForDetails.name}</span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                <span><strong>Email:</strong> {selectedForDetails.email}</span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                <span><strong>Teléfono:</strong> {selectedForDetails.phone || 'No especificado'}</span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>
                  <strong>Fecha:</strong>{' '}
                  {selectedForDetails.preferredDate
                    ? new Date(selectedForDetails.preferredDate).toLocaleString('es-ES')
                    : 'Sin fecha'}
                </span>
              </div>

              {selectedForDetails.token && (
                <div className="bg-sky-950/60 border border-sky-800/80 p-3 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-mono text-sky-300 font-bold uppercase flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" /> Enlace de Confirmación
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/entrevistas?token=${selectedForDetails.token}&email=${encodeURIComponent(selectedForDetails.email)}`}
                      className="w-full bg-zinc-950 border border-sky-900 rounded p-1.5 text-[10px] font-mono text-sky-200"
                    />
                    <button
                      onClick={() => copyInviteLink(selectedForDetails.token, selectedForDetails.email)}
                      className="bg-sky-600 hover:bg-sky-500 text-white px-2.5 py-1.5 rounded text-[10px] font-medium shrink-0 transition"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1 pt-1">
                <strong className="text-zinc-400 block">Descripción / Notas:</strong>
                <p className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-300 leading-relaxed font-sans">
                  {selectedForDetails.description || 'Sin descripción adicional.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <button
                onClick={() => openDocsModal(selectedForDetails.name, selectedForDetails.email)}
                className="text-purple-400 hover:text-purple-200 text-xs font-medium flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Enviar Autorización</span>
              </button>

              <button
                onClick={() => setSelectedForDetails(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCS & AUTHORIZATIONS MODAL ── */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowDocsModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <span>Centro de Autorizaciones Veredillas FM</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Descarga el documento de derechos de imagen / voz o envíalo directamente por correo al invitado.
              </p>
            </div>

            {/* Recipient Input */}
            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl space-y-2">
              <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Destinatario del Email</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Nombre del destinatario"
                  value={docRecipientName}
                  onChange={(e) => setDocRecipientName(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-purple-500"
                />
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={docRecipientEmail}
                  onChange={(e) => setDocRecipientEmail(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {DOC_TEMPLATES.map((doc) => (
                <div
                  key={doc.type}
                  className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-3 hover:border-purple-800/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{doc.icon}</span>
                    <div>
                      <h4 className="font-bold text-zinc-100">{doc.title}</h4>
                      <p className="text-[10px] font-mono text-zinc-500">{doc.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-900">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 py-1.5 px-2 rounded-lg text-center font-medium transition flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Descargar</span>
                    </a>

                    <button
                      onClick={() => handleSendAuthorization(doc.type, doc.url)}
                      disabled={sendingDocType === doc.type}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-1.5 px-2 rounded-lg text-center font-medium transition flex items-center justify-center gap-1 shadow-lg shadow-purple-600/20"
                    >
                      {sendingDocType === doc.type ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Enviar Email</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end border-t border-zinc-800 pt-3">
              <button
                onClick={() => setShowDocsModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-100">¿Eliminar invitación?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Esta acción eliminará la solicitud de entrevista sobre &ldquo;<strong className="text-zinc-200">{itemToDelete.topic}</strong>&rdquo; para <strong className="text-zinc-200">{itemToDelete.name}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition shadow-lg shadow-rose-600/20"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
