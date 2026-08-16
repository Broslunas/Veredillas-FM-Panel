'use client';

import React, { useMemo } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import {
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_LABELS,
  PermissionLevel,
  PermissionOverrides,
  PermissionSection,
  ROLE_DEFAULTS,
  SECTIONS,
  Role,
} from '@/lib/permissions';

interface PermissionsEditorProps {
  role: Role;
  overrides: PermissionOverrides;
  onChange: (next: PermissionOverrides) => void;
  disabled?: boolean;
}

const LEVEL_STYLES: Record<PermissionLevel, string> = {
  none: 'bg-rose-950/70 border-rose-800 text-rose-300',
  read: 'bg-amber-950/70 border-amber-800 text-amber-300',
  write: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
};

export default function PermissionsEditor({ role, overrides, onChange, disabled }: PermissionsEditorProps) {
  const defaults = ROLE_DEFAULTS[role];

  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof SECTIONS[number][]>();
    for (const section of SECTIONS) {
      const list = byGroup.get(section.group) || [];
      list.push(section);
      byGroup.set(section.group, list);
    }
    return Array.from(byGroup.entries());
  }, []);

  const overrideCount = Object.keys(overrides).length;

  const setLevel = (section: PermissionSection, level: PermissionLevel) => {
    const next = { ...overrides };
    // Selecting the role default again means "inherit", so drop the override.
    if (defaults[section] === level) delete next[section];
    else next[section] = level;
    onChange(next);
  };

  if (role === 'owner') {
    return (
      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400">
        <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
        <span>El propietario siempre tiene acceso completo a todas las secciones.</span>
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-400">
        <ShieldCheck className="w-4 h-4 text-zinc-500 shrink-0" />
        <span>Los usuarios sin rol de staff no acceden al panel. Cambia el rol para asignar permisos.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Por defecto hereda del rol <span className="font-mono text-zinc-300">{role}</span>.
          {overrideCount > 0 && (
            <span className="text-indigo-400"> {overrideCount} sección(es) personalizada(s).</span>
          )}
        </p>
        {overrideCount > 0 && !disabled && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 transition shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restablecer al rol</span>
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {groups.map(([groupTitle, sections]) => (
          <div key={groupTitle} className="space-y-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">{groupTitle}</p>

            {sections.map((section) => {
              const current = overrides[section.key] ?? defaults[section.key];
              const isOverridden = overrides[section.key] !== undefined;

              return (
                <div
                  key={section.key}
                  className="flex items-center justify-between gap-3 bg-zinc-950 border border-zinc-800/80 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-zinc-200 font-medium truncate flex items-center gap-1.5">
                      {section.label}
                      {isOverridden && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">{section.description}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {PERMISSION_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        disabled={disabled}
                        onClick={() => setLevel(section.key, level)}
                        className={`text-[10px] font-mono px-2 py-1 rounded border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          current === level
                            ? LEVEL_STYLES[level]
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {PERMISSION_LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
