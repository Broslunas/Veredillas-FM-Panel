'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import R2Uploader from '@/components/R2Uploader';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  List,
  MessageSquare,
  Video,
  HelpCircle,
  Radio,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface EpisodeEditorProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function EpisodeEditorForm({ initialData, isEdit = false }: EpisodeEditorProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'general' | 'media' | 'sections' | 'transcript' | 'clips_quiz'>('general');
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    pubDate: initialData?.pubDate ? new Date(initialData.pubDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    author: initialData?.author || 'Veredillas FM',
    image: initialData?.image || '',
    spotifyUrl: initialData?.spotifyUrl || '',
    audioUrl: initialData?.audioUrl || '',
    duration: initialData?.duration || '',
    season: initialData?.season || '',
    episode: initialData?.episode || '',
    videoUrl: initialData?.videoUrl || '',
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : initialData?.tags || 'General',
    participants: Array.isArray(initialData?.participants) ? initialData.participants.join(', ') : initialData?.participants || '',
    isPremiere: Boolean(initialData?.isPremiere),
    warningMessage: initialData?.warningMessage || '',
    body: initialData?.body || '',
    sections: initialData?.sections || [{ title: '', time: '00:00' }],
    transcription: initialData?.transcription || [{ time: '00:00', text: '', speaker: '' }],
    clips: initialData?.clips || [{ title: '', url: '' }],
    quiz: initialData?.quiz || [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }],
  });

  const handleTitleChange = (val: string) => {
    const updated: any = { title: val };
    if (!isEdit && !formData.slug) {
      updated.slug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    setFormData((prev) => ({ ...prev, ...updated }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      ...formData,
      season: formData.season ? Number(formData.season) : undefined,
      episode: formData.episode ? Number(formData.episode) : undefined,
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags,
      participants: typeof formData.participants === 'string' ? formData.participants.split(',').map((p) => p.trim()).filter(Boolean) : formData.participants,
      sections: formData.sections.filter((s: any) => s.title.trim() !== ''),
      transcription: formData.transcription.filter((t: any) => t.text.trim() !== ''),
      clips: formData.clips.filter((c: any) => c.title.trim() !== '' && c.url.trim() !== ''),
      quiz: formData.quiz.filter((q: any) => q.question.trim() !== ''),
    };

    try {
      const url = isEdit ? `/api/episodes/${initialData._id}` : '/api/episodes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el episodio');

      setSuccessMessage(isEdit ? 'Episodio actualizado con éxito' : 'Episodio creado con éxito');
      setTimeout(() => {
        router.push('/episodes');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el episodio');
    } finally {
      setSaving(false);
    }
  };

  // Section helpers
  const addSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, { title: '', time: '00:00' }],
    }));
  };

  const removeSection = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateSection = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.sections];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, sections: copy };
    });
  };

  // Transcription helpers
  const addTranscription = () => {
    setFormData((prev) => ({
      ...prev,
      transcription: [...prev.transcription, { time: '00:00', text: '', speaker: '' }],
    }));
  };

  const removeTranscription = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      transcription: prev.transcription.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateTranscription = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.transcription];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, transcription: copy };
    });
  };

  // Clips helpers
  const addClip = () => {
    setFormData((prev) => ({
      ...prev,
      clips: [...prev.clips, { title: '', url: '' }],
    }));
  };

  const removeClip = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      clips: prev.clips.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateClip = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.clips];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, clips: copy };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/episodes')}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {isEdit ? `Editar Episodio` : 'Nuevo Episodio'}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {formData.slug ? `/episodios/${formData.slug}` : 'Configuración de episodio'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Guardar Episodio'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-300 font-mono">
          {errorMessage}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>1. Información General</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('media')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'media'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>2. Archivos & R2</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'sections'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>3. Capítulos / Secciones ({formData.sections.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'transcript'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>4. Transcripción</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clips_quiz')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'clips_quiz'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>5. Clips & Quiz</span>
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Título del Episodio *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ej: Amor Sin Filtros ft. Saray"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Slug Único *
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="amor-sin-filtros"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Descripción Corta *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve resumen del episodio..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Fecha de Publicación
              </label>
              <input
                type="datetime-local"
                value={formData.pubDate}
                onChange={(e) => setFormData({ ...formData, pubDate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Autor
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Veredillas FM"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Duración (ej: 37 min)
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="37 min"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Temporada
              </label>
              <input
                type="number"
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                placeholder="1"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Nº de Episodio
              </label>
              <input
                type="number"
                value={formData.episode}
                onChange={(e) => setFormData({ ...formData, episode: e.target.value })}
                placeholder="5"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.isPremiere}
                  onChange={(e) => setFormData({ ...formData, isPremiere: e.target.checked })}
                  className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0"
                />
                <span>Marcar como Próximo Estreno (Is Premiere)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Etiquetas (separadas por coma)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="General, Amor, Entrevista"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Participantes (separados por coma)
              </label>
              <input
                type="text"
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                placeholder="Saray, Antonieta"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Mensaje de Advertencia (Contenido Sensible)
            </label>
            <input
              type="text"
              value={formData.warningMessage}
              onChange={(e) => setFormData({ ...formData, warningMessage: e.target.value })}
              placeholder="Este episodio contiene lenguaje explícito..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>
      )}

      {/* TAB 2: MEDIA & R2 */}
      {activeTab === 'media' && (
        <div className="space-y-6 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <R2Uploader
            label="Imagen de Portada (R2 Upload)"
            accept="image/*"
            folder="episodes/covers"
            value={formData.image}
            onChange={(url) => setFormData({ ...formData, image: url })}
            helperText="Formato recomendado: WebP / JPG / PNG (1:1 relación de aspecto)."
          />

          <R2Uploader
            label="Archivo de Audio Principal (R2 Direct Upload)"
            accept="audio/*"
            folder="episodes/audio"
            value={formData.audioUrl}
            onChange={(url) => setFormData({ ...formData, audioUrl: url })}
            helperText="Subida directa a Cloudflare R2 sin consumo de ancho de banda de Vercel. Formato MP3 o WAV."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                URL de Spotify
              </label>
              <input
                type="text"
                value={formData.spotifyUrl}
                onChange={(e) => setFormData({ ...formData, spotifyUrl: e.target.value })}
                placeholder="https://open.spotify.com/episode/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                URL de Vídeo (YouTube / Spotify Video)
              </label>
              <input
                type="text"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECTIONS / CAPÍTULOS */}
      {activeTab === 'sections' && (
        <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Secciones y Capítulos del Episodio</h3>
              <p className="text-xs text-zinc-400">Añade marcas de tiempo para permitir la navegación por capítulos</p>
            </div>

            <button
              type="button"
              onClick={addSection}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Añadir Sección</span>
            </button>
          </div>

          <div className="space-y-2">
            {formData.sections.map((sec: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2 border border-zinc-800/80 rounded-lg">
                <input
                  type="text"
                  value={sec.time}
                  onChange={(e) => updateSection(idx, 'time', e.target.value)}
                  placeholder="00:00"
                  className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-zinc-600"
                />
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => updateSection(idx, 'title', e.target.value)}
                  placeholder="Título de la sección (ej: Intro / Bienvenida)"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => removeSection(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TRANSCRIPTION */}
      {activeTab === 'transcript' && (
        <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Transcripción Sincronizada</h3>
              <p className="text-xs text-zinc-400">Líneas de voz con tiempo y hablante asignado</p>
            </div>

            <button
              type="button"
              onClick={addTranscription}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Añadir Línea</span>
            </button>
          </div>

          <div className="space-y-3">
            {formData.transcription.map((tr: any, idx: number) => (
              <div key={idx} className="bg-zinc-950 p-3 border border-zinc-800/80 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tr.time}
                    onChange={(e) => updateTranscription(idx, 'time', e.target.value)}
                    placeholder="00:00"
                    className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-center"
                  />
                  <input
                    type="text"
                    value={tr.speaker || ''}
                    onChange={(e) => updateTranscription(idx, 'speaker', e.target.value)}
                    placeholder="Hablante (ej: Saray)"
                    className="w-48 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeTranscription(idx)}
                    className="ml-auto p-1 text-zinc-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tr.text}
                  onChange={(e) => updateTranscription(idx, 'text', e.target.value)}
                  placeholder="Texto dicho en este fragmento de tiempo..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CLIPS & QUIZ */}
      {activeTab === 'clips_quiz' && (
        <div className="space-y-6 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          {/* Clips */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Clips de Vídeo (YouTube Shorts)</h3>
              <button
                type="button"
                onClick={addClip}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Añadir Clip</span>
              </button>
            </div>

            {formData.clips.map((clip: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2 border border-zinc-800/80 rounded-lg">
                <input
                  type="text"
                  value={clip.title}
                  onChange={(e) => updateClip(idx, 'title', e.target.value)}
                  placeholder="Título del clip"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100"
                />
                <input
                  type="text"
                  value={clip.url}
                  onChange={(e) => updateClip(idx, 'url', e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeClip(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
