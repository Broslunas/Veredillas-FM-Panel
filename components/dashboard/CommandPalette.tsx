'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Radio, FileText, UserCheck, Users, Images, Plus, CornerDownLeft } from 'lucide-react';
import { PermissionMap, PermissionSection, can } from '@/lib/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: PermissionSection;
  isPopUp?: boolean;
  action?: () => void;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface CommandPaletteProps {
  navGroups: NavGroup[];
  permissions?: PermissionMap | null;
}

interface Command {
  key: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  onSelect: () => void;
}

interface SearchSource {
  key: string;
  section: PermissionSection;
  endpoint: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  label: (item: any) => string;
  sublabel: (item: any) => string;
  href: (item: any) => string;
}

const QUICK_ACTIONS: { label: string; href: string; section: PermissionSection }[] = [
  { label: 'Nuevo Episodio', href: '/episodes/new', section: 'episodes' },
  { label: 'Nuevo Artículo de Blog', href: '/blog/new', section: 'blog' },
  { label: 'Nuevo Invitado', href: '/guests/new', section: 'guests' },
];

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString('es-ES') : '';
}

const SEARCH_SOURCES: SearchSource[] = [
  {
    key: 'episodes',
    section: 'episodes',
    endpoint: '/api/episodes',
    group: 'Episodios',
    icon: Radio,
    label: (item) => item.title,
    sublabel: (item) => [item.status === 'draft' ? 'Borrador' : null, formatDate(item.pubDate)].filter(Boolean).join(' · '),
    href: (item) => `/episodes/${item._id}`,
  },
  {
    key: 'blog',
    section: 'blog',
    endpoint: '/api/blog',
    group: 'Blog',
    icon: FileText,
    label: (item) => item.title,
    sublabel: (item) => [item.author, formatDate(item.pubDate)].filter(Boolean).join(' · '),
    href: (item) => `/blog/${item._id}`,
  },
  {
    key: 'guests',
    section: 'guests',
    endpoint: '/api/guests',
    group: 'Invitados',
    icon: UserCheck,
    label: (item) => item.name,
    sublabel: (item) => item.role || 'Invitado',
    href: (item) => `/guests/${item._id}`,
  },
  {
    key: 'gallery',
    section: 'gallery',
    endpoint: '/api/gallery',
    group: 'Galería',
    icon: Images,
    label: (item) => item.category,
    sublabel: (item) => `${item.images?.length || 0} elemento(s)`,
    href: (item) => `/gallery/${item._id}`,
  },
  {
    key: 'team',
    section: 'team',
    endpoint: '/api/team',
    group: 'Equipo',
    icon: Users,
    label: (item) => item.name,
    sublabel: (item) => [item.role, item.schoolYear].filter(Boolean).join(' · '),
    href: (item) => `/team/${item._id}`,
  },
];

const RESULTS_PER_SOURCE = 4;

export default function CommandPalette({ navGroups, permissions }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({});
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sources = useMemo(
    () => SEARCH_SOURCES.filter((source) => can(permissions, source.section)),
    [permissions]
  );

  const close = () => {
    setOpen(false);
    setQuery('');
    setSearchResults({});
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSearchResults({});
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const q = encodeURIComponent(query.trim());
      try {
        const responses = await Promise.all(
          sources.map(async (source) => {
            try {
              const res = await fetch(`${source.endpoint}?q=${q}`);
              if (!res.ok) return [source.key, []] as const;
              const data = await res.json();
              return [source.key, Array.isArray(data) ? data.slice(0, RESULTS_PER_SOURCE) : []] as const;
            } catch {
              return [source.key, []] as const;
            }
          })
        );
        setSearchResults(Object.fromEntries(responses));
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sources]);

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const commands: Command[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Command[] = [];

    const matchesQuery = (label: string) => q.length === 0 || label.toLowerCase().includes(q);

    QUICK_ACTIONS.filter((item) => can(permissions, item.section, 'write') && matchesQuery(item.label)).forEach(
      (item) => {
        list.push({
          key: `quick-${item.href}`,
          label: item.label,
          icon: Plus,
          group: 'Acciones Rápidas',
          onSelect: () => navigate(item.href),
        });
      }
    );

    navGroups.forEach((group) => {
      group.items.filter((item) => matchesQuery(item.label)).forEach((item) => {
        list.push({
          key: `nav-${item.href}`,
          label: item.label,
          icon: item.icon,
          group: 'Navegación',
          onSelect: () => {
            if (item.isPopUp && item.action) {
              close();
              item.action();
            } else {
              navigate(item.href);
            }
          },
        });
      });
    });

    sources.forEach((source) => {
      (searchResults[source.key] || []).forEach((item) => {
        list.push({
          key: `${source.key}-${item._id}`,
          label: source.label(item) || '(sin título)',
          sublabel: source.sublabel(item),
          icon: source.icon,
          group: source.group,
          onSelect: () => navigate(source.href(item)),
        });
      });
    });

    return list;
  }, [query, navGroups, searchResults, sources, permissions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [commands.length, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commands[activeIndex]?.onSelect();
    }
  };

  if (!open) return null;

  const groupedEntries: [string, Command[]][] = [];
  commands.forEach((cmd) => {
    const existing = groupedEntries.find(([title]) => title === cmd.group);
    if (existing) existing[1].push(cmd);
    else groupedEntries.push([cmd.group, [cmd]]);
  });

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center pt-24 px-4"
      onClick={close}
    >
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800/80">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar contenido o navegar por el panel..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {searching && <span className="text-[10px] font-mono text-zinc-500">Buscando…</span>}
          <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {commands.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono text-center py-8">
              {searching ? 'Buscando...' : 'Sin resultados.'}
            </p>
          ) : (
            groupedEntries.map(([groupTitle, items]) => (
              <div key={groupTitle} className="px-2 py-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 px-2 py-1">{groupTitle}</p>
                {items.map((cmd) => {
                  flatIndex += 1;
                  const isActive = flatIndex === activeIndex;
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.key}
                      onClick={cmd.onSelect}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition ${
                        isActive ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate flex-1">{cmd.label}</span>
                      {cmd.sublabel && (
                        <span className="text-[10px] text-zinc-500 font-mono shrink-0 truncate max-w-[45%]">
                          {cmd.sublabel}
                        </span>
                      )}
                      {isActive && <CornerDownLeft className="w-3 h-3 text-zinc-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
