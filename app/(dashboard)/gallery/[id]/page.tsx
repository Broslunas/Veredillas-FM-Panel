'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import GalleryEditorForm from '@/components/GalleryEditorForm';
import { Loader2 } from 'lucide-react';

export default function EditGalleryCategoryPage() {
  const params = useParams();
  const id = params?.id as string;
  const [category, setCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCategory() {
      try {
        const res = await fetch(`/api/gallery/${id}`);
        if (!res.ok) {
          throw new Error('Categoría de galería no encontrada');
        }
        const data = await res.json();
        setCategory(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar la categoría de galería');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadCategory();
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        <span className="text-xs font-mono">Cargando categoría de galería...</span>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="p-12 text-center text-red-400 font-mono text-xs">
        {error || 'No se pudo cargar la categoría de galería.'}
      </div>
    );
  }

  return <GalleryEditorForm initialData={category} isEdit={true} />;
}
