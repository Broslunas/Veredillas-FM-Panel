'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Plus, UserCheck, X } from 'lucide-react';
import { GUEST_CREATED_MESSAGE_TYPE, openGuestQuickCreatePopup } from '@/lib/guestQuickCreate';

interface Guest {
  _id: string;
  name: string;
  role?: string;
}

interface ParticipantsPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ParticipantsPicker({ value, onChange }: ParticipantsPickerProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => value.split(',').map((v) => v.trim()).filter(Boolean), [value]);

  useEffect(() => {
    let cancelled = false;
    setLoadingGuests(true);
    fetch('/api/guests')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setGuests(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGuests(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addParticipant = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...selected, trimmed].join(', '));
  };

  const removeParticipant = (name: string) => {
    onChange(selected.filter((s) => s !== name).join(', '));
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== GUEST_CREATED_MESSAGE_TYPE || !e.data.guest?.name) return;
      setGuests((prev) => (prev.some((g) => g._id === e.data.guest._id) ? prev : [e.data.guest, ...prev]));
      addParticipant(e.data.guest.name);
      setQuery('');
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filteredGuests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests
      .filter((g) => !selected.some((s) => s.toLowerCase() === g.name.toLowerCase()))
      .filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [guests, selected, query]);

  const exactMatchExists = guests.some((g) => g.name.toLowerCase() === query.trim().toLowerCase());

  const handleCreateNew = () => {
    openGuestQuickCreatePopup(query.trim());
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        onClick={() => setOpen(true)}
        className="w-full min-h-[42px] bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-zinc-500 transition"
      >
        {selected.map((name) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 bg-indigo-950/60 border border-indigo-800/60 text-indigo-200 text-xs px-2 py-1 rounded-md"
          >
            {name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeParticipant(name);
              }}
              className="text-indigo-400 hover:text-indigo-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!query.trim()) return;
              if (exactMatchExists) {
                addParticipant(query.trim());
                setQuery('');
              } else {
                handleCreateNew();
              }
            } else if (e.key === 'Backspace' && !query && selected.length) {
              removeParticipant(selected[selected.length - 1]);
            }
          }}
          placeholder={selected.length ? '' : 'Buscar o añadir participante...'}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none py-0.5"
        />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {loadingGuests ? (
            <div className="p-3 flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Cargando invitados...</span>
            </div>
          ) : (
            <>
              {filteredGuests.length > 0 ? (
                filteredGuests.map((g) => (
                  <button
                    key={g._id}
                    type="button"
                    onClick={() => {
                      addParticipant(g.name);
                      setQuery('');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/80 transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate font-medium">{g.name}</span>
                    {g.role && <span className="text-zinc-500 truncate">— {g.role}</span>}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-zinc-500">
                  {query ? 'Sin coincidencias entre los invitados existentes.' : 'No hay más invitados disponibles.'}
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateNew}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-indigo-300 hover:bg-indigo-950/40 border-t border-zinc-800/80 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{query.trim() ? `Crear "${query.trim()}" como nuevo invitado` : 'Crear nuevo invitado'}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
