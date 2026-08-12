'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import R2Uploader from '@/components/R2Uploader';
import { Save, ArrowLeft, Loader2, CheckCircle2, Eye, Edit3, Sparkles } from 'lucide-react';
import { useAutoSaveDraft } from '@/lib/useAutoSaveDraft';
import AutoSaveDraftBanner from '@/components/AutoSaveDraftBanner';
import AutoSaveStatus from '@/components/AutoSaveStatus';

interface BlogEditorProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function BlogEditorForm({ initialData, isEdit = false }: BlogEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gemini AI content generation
  const [aiTopic, setAiTopic] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    pubDate: initialData?.pubDate ? new Date(initialData.pubDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    author: initialData?.author || 'Redacción Veredillas',
    image: initialData?.image || '',
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : initialData?.tags || '',
    body: initialData?.body || '',
  });

  const {
    lastAutoSavedAt,
    draftAvailable,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    markSaved,
  } = useAutoSaveDraft(`blog:${initialData?._id || 'new'}`, formData);

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (draft) setFormData(draft);
  };

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

  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) {
      setAiError('Escribe primero un tema para generar el artículo.');
      return;
    }

    setAiError(null);
    setAiStatus('Generando artículo con Gemini AI...');
    setAiLoading(true);

    try {
      const res = await fetch('/api/admin/gemini/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, notes: aiNotes, tags: formData.tags }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el artículo con IA');

      setFormData((prev) => ({
        ...prev,
        title: data.title || prev.title,
        slug: prev.slug || data.slug || prev.slug,
        description: data.description || prev.description,
        tags: Array.isArray(data.tags) && data.tags.length ? data.tags.join(', ') : prev.tags,
        body: data.body || prev.body,
      }));
      setAiStatus('¡Contenido generado! Revisa y ajusta el artículo antes de publicar.');
    } catch (err: any) {
      setAiError(err.message || 'Error al generar el artículo con IA');
      setAiStatus(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      ...formData,
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags,
    };

    try {
      const url = isEdit ? `/api/blog/${initialData._id}` : '/api/blog';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el artículo');

      markSaved();
      setSuccessMessage(isEdit ? 'Artículo actualizado con éxito' : 'Artículo publicado con éxito');
      setTimeout(() => {
        router.push('/blog');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el artículo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/blog')}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {isEdit ? 'Editar Artículo' : 'Nuevo Artículo de Blog'}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {formData.slug ? `/blog/${formData.slug}` : 'Redacción y publicación'}
            </p>
            <AutoSaveStatus lastAutoSavedAt={lastAutoSavedAt} />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Publicar Artículo'}</span>
        </button>
      </div>

      {draftAvailable && (
        <AutoSaveDraftBanner savedAt={draftSavedAt} onRestore={handleRestoreDraft} onDiscard={discardDraft} />
      )}

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

      {/* Gemini AI Content Generation */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-purple-950/60 border border-indigo-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-indigo-900/40 pb-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <span>Generar Artículo con IA</span>
              <span className="text-[10px] font-mono font-bold bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded">
                Gemini
              </span>
            </h4>
            <p className="text-xs text-zinc-400">
              Describe el tema y Gemini redactará título, descripción, etiquetas y el cuerpo completo del artículo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-zinc-300 font-mono text-[11px] font-semibold">Tema del artículo *</label>
            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="Ej: Resumen de la gala de fin de curso"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-7 space-y-1.5">
            <label className="text-zinc-300 font-mono text-[11px] font-semibold">Notas / contexto adicional (opcional)</label>
            <input
              type="text"
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              placeholder="Detalles, nombres, enlaces o cualquier información a incluir..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerateWithAI}
          disabled={aiLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-md shadow-indigo-600/20"
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Generando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-indigo-300" />
              <span>Generar Contenido con IA</span>
            </>
          )}
        </button>

        {aiStatus && !aiError && (
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-xs font-mono text-indigo-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{aiStatus}</span>
          </div>
        )}

        {aiError && (
          <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs font-mono text-rose-300 flex items-center gap-2">
            <span className="text-rose-400 font-bold">⚠️ Error:</span>
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Título del Artículo *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Ej: ¡Bienvenidos al nuevo curso en Veredillas FM!"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-medium placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
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
              placeholder="bienvenidos-nuevo-curso"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Descripción Resumen *
          </label>
          <textarea
            required
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Un breve resumen que aparecerá en la tarjeta del blog..."
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
              placeholder="Redacción Veredillas"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="Bienvenida, Noticias, Radio"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>

        <R2Uploader
          label="Imagen de Portada (R2 Upload)"
          accept="image/*"
          folder="blog"
          entityId={formData.slug}
          value={formData.image}
          onChange={(url) => setFormData({ ...formData, image: url })}
          helperText="Imagen principal de cabecera del artículo."
        />

        {/* Content Body Editor with Preview */}
        <div className="space-y-2 pt-4 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              Cuerpo del Artículo (Soporta Markdown y HTML)
            </label>

            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 px-3 py-1 rounded-md transition"
            >
              {previewMode ? (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Modo Edición</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vista Previa</span>
                </>
              )}
            </button>
          </div>

          {previewMode ? (
            <div className="w-full min-h-[300px] bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-200 prose prose-invert max-w-none">
              {formData.body ? (
                <div dangerouslySetInnerHTML={{ __html: formData.body.replace(/\n/g, '<br/>') }} />
              ) : (
                <span className="text-zinc-600 font-mono text-xs">El cuerpo del artículo está vacío...</span>
              )}
            </div>
          ) : (
            <textarea
              rows={12}
              value={formData.body}
              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
              placeholder="Escribe el contenido completo del artículo aquí..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          )}
        </div>
      </div>
    </form>
  );
}
