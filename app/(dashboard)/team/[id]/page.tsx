'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TeamEditorForm from '@/components/TeamEditorForm';
import { Loader2 } from 'lucide-react';

export default function EditTeamMemberPage() {
  const params = useParams();
  const id = params?.id as string;
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMember() {
      try {
        const res = await fetch(`/api/team/${id}`);
        if (!res.ok) {
          throw new Error('Miembro del equipo no encontrado');
        }
        const data = await res.json();
        setMember(data);
      } catch (err: any) {
        setError(err.message || 'Error al cargar el miembro del equipo');
      } finally {
        setLoading(false);
      }
    }

    if (id) loadMember();
  }, [id]);

  if (loading) {
    return (
      <div className="p-12 flex justify-center text-zinc-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        <span className="text-xs font-mono">Cargando miembro del equipo...</span>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="p-12 text-center text-red-400 font-mono text-xs">
        {error || 'No se pudo cargar el miembro del equipo.'}
      </div>
    );
  }

  return <TeamEditorForm initialData={member} isEdit={true} />;
}
