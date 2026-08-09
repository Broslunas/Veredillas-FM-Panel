'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import R2Uploader from '@/components/R2Uploader';
import { Save, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface GuestEditorProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function GuestEditorForm({ initialData, isEdit = false }: GuestEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    role: initialData?.role || '',
    image: initialData?.image || '',
    description: initialData?.description || '',
    body: initialData?.body || '',
    social: {
      twitter: initialData?.social?.twitter || '',
      instagram: initialData?.social?.instagram || '',
      website: initialData?.social?.website || '',
    },
  });

  const handleNameChange = (val: string) => {
    const updated: any = { name: val };
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

    try {
      const url = isEdit ? `/api/guests/${initialData._id}` : '/api/guests';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el invitado');

      setSuccessMessage(isEdit ? 'Invitado actualizado con éxito' : 'Invitado creado con éxito');
      setTimeout(() => {
        router.push('/guests');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el invitado');
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
            onClick={() => router.push('/guests')}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {isEdit ? 'Editar Invitado' : 'Nuevo Invitado'}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {formData.slug ? `/invitados/${formData.slug}` : 'Perfil de participante'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Guardar Invitado'}</span>
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

      {/* Form Content */}
      <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Prof. Alejandro"
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
              placeholder="prof-alejandro"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Rol / Cargo en el Centro
          </label>
          <input
            type="text"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="Ej: Profesor de Informática / Alumno de 2º Bachillerato"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        <R2Uploader
          label="Foto de Perfil (R2 Upload)"
          accept="image/*"
          folder="guest"
          entityId={formData.slug}
          value={formData.image}
          onChange={(url) => setFormData({ ...formData, image: url })}
          helperText="Foto de perfil en formato cuadrado recomendado."
        />

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
            Breve Descripción
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Biografía corta del invitado..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Social Links */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
            Redes Sociales (Opcionales)
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Twitter / X</label>
              <input
                type="text"
                value={formData.social.twitter}
                onChange={(e) =>
                  setFormData({ ...formData, social: { ...formData.social, twitter: e.target.value } })
                }
                placeholder="https://twitter.com/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Instagram</label>
              <input
                type="text"
                value={formData.social.instagram}
                onChange={(e) =>
                  setFormData({ ...formData, social: { ...formData.social, instagram: e.target.value } })
                }
                placeholder="https://instagram.com/..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-zinc-500 mb-1">Sitio Web</label>
              <input
                type="text"
                value={formData.social.website}
                onChange={(e) =>
                  setFormData({ ...formData, social: { ...formData.social, website: e.target.value } })
                }
                placeholder="https://miweb.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
