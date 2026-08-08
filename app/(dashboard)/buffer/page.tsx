'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Share2,
  Calendar as CalendarIcon,
  ListFilter,
  ExternalLink,
  RefreshCw,
  Info,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  X,
  Globe,
  Radio
} from 'lucide-react';

interface BufferChannel {
  id: string;
  name: string;
  service: string;
  formatted_username?: string;
}

interface ScheduledPost {
  id: string;
  text: string;
  due_at: string;
  _profile: {
    id: string;
    service: string;
    name: string;
  };
}

export default function SocialPublisherHubPage() {
  const [configured, setConfigured] = useState(true);
  const [profiles, setProfiles] = useState<BufferChannel[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // View state: 'timeline' | 'calendar'
  const [activeView, setActiveView] = useState<'timeline' | 'calendar'>('timeline');
  const [showInfoModal, setShowInfoModal] = useState(false);

  const fetchBufferData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/buffer');
      const data = await res.json();

      setConfigured(data.configured ?? true);
      setErrorMsg(data.error || null);
      setProfiles(data.profiles || []);
      setScheduledPosts(data.scheduledPosts || []);
    } catch (err: any) {
      console.error('Error fetching Buffer data:', err);
      setErrorMsg('Error al conectar con la API de Buffer');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBufferData();
  }, [fetchBufferData]);

  // Calendar Window (7 Next Natural Days)
  const calendarDays = useMemo(() => {
    const postsByDate: Record<string, ScheduledPost[]> = {};
    scheduledPosts.forEach((p) => {
      const dateStr = new Date(p.due_at).toISOString().split('T')[0];
      if (!postsByDate[dateStr]) postsByDate[dateStr] = [];
      postsByDate[dateStr].push(p);
    });

    const days = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const target = new Date(today);
      target.setDate(today.getDate() + i);
      const dateStr = target.toISOString().split('T')[0];
      const weekday = target
        .toLocaleDateString('es-ES', { weekday: 'short' })
        .toUpperCase();
      const dayNum = target.toLocaleDateString('es-ES', { day: 'numeric' });
      const month = target.toLocaleDateString('es-ES', { month: 'short' });

      days.push({
        dateStr,
        weekday,
        dayNum,
        month,
        posts: postsByDate[dateStr] || [],
      });
    }
    return days;
  }, [scheduledPosts]);

  function formatDateFull(isoStr: string) {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoStr));
    } catch {
      return isoStr;
    }
  }

  function formatTimeOnly(isoStr: string) {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoStr));
    } catch {
      return isoStr;
    }
  }

  function renderServiceIcon(service: string) {
    const s = service?.toLowerCase() || '';
    if (s.includes('twitter') || s.includes('x')) {
      return <Globe className="w-4 h-4 text-sky-400" />;
    }
    if (s.includes('instagram')) {
      return <Radio className="w-4 h-4 text-pink-400" />;
    }
    if (s.includes('facebook')) {
      return <Globe className="w-4 h-4 text-blue-500" />;
    }
    if (s.includes('linkedin')) {
      return <Globe className="w-4 h-4 text-blue-400" />;
    }
    if (s.includes('tiktok')) {
      return <Share2 className="w-4 h-4 text-emerald-400" />;
    }
    return <Share2 className="w-4 h-4 text-indigo-400" />;
  }

  if (loading && scheduledPosts.length === 0 && profiles.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Conectando con Social Publisher Hub...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── HEADER WITH BETTER NAME & INFO BUTTON ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
              <span>Social Publisher Hub</span>
              <Share2 className="w-6 h-6 text-indigo-400" />
            </h1>

            {/* INFO BUTTON */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 hover:text-white hover:bg-indigo-900 transition shadow-sm flex items-center gap-1.5 text-xs font-mono"
              title="Información y guía sobre el publicador"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Info & Guía</span>
            </button>
          </div>

          <p className="text-xs text-zinc-400 mt-1">
            Planificador multicanal de redes sociales sincronizado con Buffer.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggles */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveView('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeView === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setActiveView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                activeView === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendario (7 Días)</span>
            </button>
          </div>

          <button
            onClick={() => fetchBufferData()}
            disabled={refreshing}
            className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
            title="Refrescar publicaciones"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── BUFFER TOKEN WARNING STATE ── */}
      {(!configured || errorMsg) && (
        <div className="p-6 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>Configuración de Buffer Requerida</span>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Para visualizar tus publicaciones programadas en redes sociales, asegúrate de configurar la variable de entorno{' '}
            <code className="bg-zinc-950 px-2 py-0.5 rounded font-mono text-amber-400 border border-amber-900">
              BUFFER_ACCESS_TOKEN
            </code>{' '}
            con tu token de API de Buffer.
          </p>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-zinc-950 border border-amber-900/60 font-mono text-xs text-rose-400">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* ── MAIN CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: KPI & Synced Channels */}
        <div className="lg:col-span-3 space-y-4">
          {/* Scheduled Count KPI */}
          <div className="bg-zinc-900/60 border border-indigo-900/40 p-5 rounded-2xl text-center space-y-1 shadow-lg">
            <span className="text-4xl font-black text-indigo-400 font-mono block">
              {scheduledPosts.length}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider block">
              Posts en Cola Programados
            </span>
          </div>

          {/* Synced Channels List */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Canales Conectados
              </span>
              <span className="text-[10px] font-mono text-zinc-500 font-bold">{profiles.length}</span>
            </div>

            {profiles.length === 0 ? (
              <div className="text-xs text-zinc-500 italic py-2">No hay redes vinculadas</div>
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                        {renderServiceIcon(profile.service)}
                      </div>
                      <span className="text-xs font-medium text-zinc-200 truncate max-w-[110px]">
                        {profile.formatted_username || profile.name || profile.service}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                      {profile.service}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Content Area: Timeline or Calendar */}
        <div className="lg:col-span-9 space-y-6">
          {/* VISTA 1: TIMELINE */}
          {activeView === 'timeline' && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl animate-in fade-in duration-300 min-h-[500px]">
              {scheduledPosts.length === 0 ? (
                <div className="py-20 text-center text-zinc-500 space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-zinc-600" />
                  <p className="text-sm font-semibold text-zinc-300">No hay publicaciones en cola</p>
                  <p className="text-xs font-mono text-zinc-500">
                    Las publicaciones programadas desde Buffer o n8n aparecerán aquí.
                  </p>
                </div>
              ) : (
                <div className="relative border-l-2 border-zinc-800 pl-6 space-y-6">
                  {scheduledPosts.map((post) => (
                    <div key={post.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[31px] top-4 w-3.5 h-3.5 bg-indigo-500 rounded-full border-4 border-zinc-950 group-hover:scale-125 transition-transform" />

                      <div className="bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 p-5 rounded-2xl space-y-3 transition shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                              {renderServiceIcon(post._profile?.service)}
                            </span>
                            <span className="text-xs font-bold text-zinc-200 capitalize">
                              {post._profile?.name || post._profile?.service}
                            </span>
                          </div>

                          <span className="text-xs font-mono font-bold text-emerald-400">
                            📅 {formatDateFull(post.due_at)}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap">
                          {post.text}
                        </p>

                        <div className="pt-2 flex justify-end">
                          <a
                            href={`https://publish.buffer.com/profile/${post._profile?.id}/tab/queue`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800 px-3 py-1.5 rounded-lg text-[11px] font-medium transition flex items-center gap-1.5"
                          >
                            <span>Abrir en Buffer</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: CALENDARIO (7 DÍAS) */}
          {activeView === 'calendar' && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl overflow-x-auto animate-in fade-in duration-300">
              <div className="flex gap-4 min-w-max pb-2">
                {calendarDays.map((day) => (
                  <div key={day.dateStr} className="w-64 space-y-3 flex flex-col">
                    {/* Day Column Header */}
                    <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl text-center space-y-0.5 sticky top-0 z-10 shadow-md">
                      <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                        {day.weekday}
                      </span>
                      <span className="text-2xl font-black text-zinc-100 font-mono block">
                        {day.dayNum} {day.month}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 block">
                        {day.posts.length} {day.posts.length === 1 ? 'post' : 'posts'}
                      </span>
                    </div>

                    {/* Day Posts Column */}
                    <div className="space-y-3 flex-1">
                      {day.posts.length === 0 ? (
                        <div className="h-28 border-2 border-dashed border-zinc-800/80 rounded-xl flex items-center justify-center text-zinc-600 text-xs font-mono">
                          Día Libre
                        </div>
                      ) : (
                        day.posts.map((post) => (
                          <div
                            key={post.id}
                            className="bg-zinc-950 border border-zinc-800 hover:border-indigo-500/50 p-3.5 rounded-xl space-y-2.5 transition shadow"
                          >
                            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                              <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
                                ⏰ {formatTimeOnly(post.due_at)}
                              </span>
                              <div className="w-5 h-5 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                {renderServiceIcon(post._profile?.service)}
                              </div>
                            </div>

                            <p className="text-xs text-zinc-300 line-clamp-4 leading-snug">
                              {post.text}
                            </p>

                            <a
                              href={`https://publish.buffer.com/profile/${post._profile?.id}/tab/queue`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-mono text-indigo-400 hover:text-indigo-200 flex items-center justify-end gap-1 pt-1"
                            >
                              <span>Ver en Buffer</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── INFO & GUIDE MODAL ── */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="border-b border-zinc-800 pb-3 flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  ¿Qué es el Social Publisher Hub?
                </h3>
                <p className="text-xs text-zinc-500">Centro unificado de planificación y difusión social en Buffer.</p>
              </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>1. Gestión Multicanal Sincronizada</span>
                </div>
                <p className="text-zinc-400">
                  Conectado directamente con la API GraphQL de Buffer, te permite supervisar la cola de publicaciones programadas para Twitter/X, Instagram, TikTok, Facebook y LinkedIn en un único lugar.
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  <span>2. Vistas de Timeline y Calendario Semanal</span>
                </div>
                <p className="text-zinc-400">
                  Alterna entre la vista de **Timeline** (lista cronológica detallada post a post con horas exactas) y la vista de **Calendario Semanal** (columnas por los próximos 7 días naturales) para verificar la cobertura diaria de publicaciones.
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <ExternalLink className="w-4 h-4 text-amber-400" />
                  <span>3. Enlace Directo y Automatización</span>
                </div>
                <p className="text-zinc-400">
                  Cada publicación incluye un enlace directo a la cola oficial de Buffer para editar textos, reordenar horarios o publicar inmediatamente si es necesario.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-zinc-800 pt-3">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
