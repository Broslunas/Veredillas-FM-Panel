'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import R2Uploader from '@/components/R2Uploader';
import { Save, ArrowLeft, Loader2, CheckCircle2, Plus, Trash2, Star, GripVertical } from 'lucide-react';
import { useAutoSaveDraft } from '@/lib/useAutoSaveDraft';
import AutoSaveDraftBanner from '@/components/AutoSaveDraftBanner';
import AutoSaveStatus from '@/components/AutoSaveStatus';

interface GalleryImage {
  title: string;
  src: string;
  type: 'image' | 'video';
  thumbnail: string;
  featured: boolean;
}

interface GalleryEditorProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function GalleryEditorForm({ initialData, isEdit = false }: GalleryEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: initialData?.category || '',
    slug: initialData?.slug || '',
    body: initialData?.body || '',
    images: (initialData?.images as GalleryImage[] | undefined)?.length
      ? (initialData.images as GalleryImage[]).map((img) => ({
          title: img.title || '',
          src: img.src || '',
          type: img.type || 'image',
          thumbnail: img.thumbnail || '',
          featured: img.featured || false,
        }))
      : [],
  });

  const {
    lastAutoSavedAt,
    draftAvailable,
    draftSavedAt,
    restoreDraft,
    discardDraft,
    markSaved,
  } = useAutoSaveDraft(`gallery:${initialData?._id || 'new'}`, formData);

  const handleRestoreDraft = () => {
    const draft = restoreDraft();
    if (draft) setFormData(draft);
  };

  const handleCategoryChange = (val: string) => {
    const updated: any = { category: val };
    if (!isEdit && !formData.slug) {
      updated.slug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    setFormData((prev) => ({ ...prev, ...updated }));
  };

  const updateImage = (index: number, field: keyof GalleryImage, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => (i === index ? { ...img, [field]: value } : img)),
    }));
  };

  const addImage = () => {
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, { title: '', src: '', type: 'image', thumbnail: '', featured: false }],
    }));
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    setFormData((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.images.length) return prev;
      const images = [...prev.images];
      [images[index], images[target]] = [images[target], images[index]];
      return { ...prev, images };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const url = isEdit ? `/api/gallery/${initialData._id}` : '/api/gallery';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        images: formData.images.filter((img) => img.title.trim() && img.src.trim()),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la categoría de galería');

      markSaved();
      setSuccessMessage(isEdit ? 'Categoría actualizada con éxito' : 'Categoría creada con éxito');
      setTimeout(() => {
        router.push('/gallery');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar la categoría de galería');
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
            onClick={() => router.push('/gallery')}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {isEdit ? 'Editar Categoría de Galería' : 'Nueva Categoría de Galería'}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {formData.slug ? `/galeria · ${formData.slug}` : 'Categoría de galería'}
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
          <span>{saving ? 'Guardando...' : 'Guardar Categoría'}</span>
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

      {/* Form Content */}
      <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              placeholder="Ej: Backstage, Episodios, Equipo"
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
              placeholder="backstage"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Descripción
          </label>
          <textarea
            rows={3}
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            placeholder="Descripción interna de la categoría (opcional)..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Images */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
              Imágenes y Vídeos ({formData.images.length})
            </label>
            <button
              type="button"
              onClick={addImage}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir elemento</span>
            </button>
          </div>

          {formData.images.length === 0 ? (
            <p className="text-xs text-zinc-500">Sin elementos todavía.</p>
          ) : (
            <div className="space-y-3">
              {formData.images.map((img, index) => (
                <div key={index} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <GripVertical className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-mono">Elemento {index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(index, -1)}
                        disabled={index === 0}
                        className="px-1.5 py-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition"
                        title="Mover arriba"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(index, 1)}
                        disabled={index === formData.images.length - 1}
                        className="px-1.5 py-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition"
                        title="Mover abajo"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => updateImage(index, 'featured', !img.featured)}
                        className={`p-1.5 rounded-md transition ${
                          img.featured
                            ? 'text-amber-400 bg-amber-950/30'
                            : 'text-zinc-500 hover:text-amber-400 hover:bg-amber-950/20'
                        }`}
                        title={img.featured ? 'Quitar destacado' : 'Marcar como destacado'}
                      >
                        <Star className="w-3.5 h-3.5" fill={img.featured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-md transition"
                        title="Eliminar elemento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                        Título / Alt *
                      </label>
                      <input
                        type="text"
                        value={img.title}
                        onChange={(e) => updateImage(index, 'title', e.target.value)}
                        placeholder="Descripción breve del elemento"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                        Tipo
                      </label>
                      <select
                        value={img.type}
                        onChange={(e) => updateImage(index, 'type', e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
                      >
                        <option value="image">Imagen</option>
                        <option value="video">Vídeo</option>
                      </select>
                    </div>
                  </div>

                  <R2Uploader
                    label={img.type === 'video' ? 'Vídeo (R2 Upload o URL de YouTube)' : 'Imagen (R2 Upload)'}
                    accept={img.type === 'video' ? 'video/*' : 'image/*'}
                    folder="gallery"
                    target={img.type === 'video' ? 'video' : 'image'}
                    entityId={formData.slug ? `${formData.slug}-${index}` : undefined}
                    value={img.src}
                    onChange={(url) => updateImage(index, 'src', url)}
                    helperText={
                      img.type === 'video'
                        ? 'Puedes pegar una URL de YouTube o subir un archivo de vídeo directamente.'
                        : undefined
                    }
                  />

                  {img.type === 'video' && (
                    <R2Uploader
                      label="Miniatura (opcional)"
                      accept="image/*"
                      folder="gallery"
                      target="image"
                      entityId={formData.slug ? `${formData.slug}-${index}-thumb` : undefined}
                      value={img.thumbnail}
                      onChange={(url) => updateImage(index, 'thumbnail', url)}
                      helperText="Si no se indica, se usará el propio vídeo como miniatura."
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
