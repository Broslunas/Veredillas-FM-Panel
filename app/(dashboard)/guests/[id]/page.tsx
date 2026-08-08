'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import GuestEditorForm from '@/components/GuestEditorForm';
import { Loader2 } from 'lucide-react';

export default function EditGuestPage() {
  const params = useParams();
  const id = params?.id as string;
  const [guest, setGuest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGuest() {
      try {
        const res = await fetch(`/api/guests/${id}`);
        if (!res.ok) {
          throw new Error('Invitado no encontrado');
        }
        const data = await res.json();
        setGuest(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el invitado');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadGuest();
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        <span className="text-xs font-mono">Cargando invitado...</span>
      </div>
    );
  }

  if (error || !guest) {
    return (
      <div className="p-12 text-center text-red-400 font-mono text-xs">
        {error || 'No se pudo cargar el invitado.'}
      </div>
    );
  }

  return <GuestEditorForm initialData={guest} isEdit={true} />;
}
