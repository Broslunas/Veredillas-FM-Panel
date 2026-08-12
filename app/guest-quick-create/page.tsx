'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GuestEditorForm from '@/components/GuestEditorForm';
import { Loader2 } from 'lucide-react';

function QuickCreateGuestContent() {
  const searchParams = useSearchParams();
  const prefillName = searchParams.get('name') || '';

  return <GuestEditorForm isEdit={false} popup initialData={prefillName ? { name: prefillName } : undefined} />;
}

export default function QuickCreateGuestPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense
        fallback={
          <div className="p-12 flex justify-center text-zinc-500 gap-2 font-mono text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Cargando formulario...</span>
          </div>
        }
      >
        <QuickCreateGuestContent />
      </Suspense>
    </div>
  );
}
