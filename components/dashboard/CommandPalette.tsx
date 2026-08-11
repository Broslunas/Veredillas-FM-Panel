'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Radio, FileText, UserCheck, Plus, CornerDownLeft } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isPopUp?: boolean;
  action?: () => void;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface CommandPaletteProps {
  navGroups: NavGroup[];
}

interface Command {
  key: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  onSelect: () => void;
}

const QUICK_ACTIONS: NavItem[] = [
  { label: 'Nuevo Episodio', href: '/episodes/new', icon: Plus },
  { label: 'Nuevo Artículo de Blog', href: '/blog/new', icon: Plus },
  { label: 'Nuevo Invitado', href: '/guests/new', icon: Plus },
];

export default function CommandPalette({ navGroups }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<{ episodes: any[]; blog: any[]; guests: any[] }>({
    episodes: [],
    blog: [],
    guests: [],
  });
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = () => {
    setOpen(false);
    setQuery('');
    setSearchResults({ episodes: [], blog: [], guests: [] });
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
      setSearchResults({ episodes: [], blog: [], guests: [] });
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim());
        const [epRes, blogRes, guestRes] = await Promise.all([
          fetch(`/api/episodes?q=${q}`),
          fetch(`/api/blog?q=${q}`),
          fetch(`/api/guests?q=${q}`),
        ]);
        const [episodes, blog, guests] = await Promise.all([
          epRes.ok ? epRes.json() : [],
          blogRes.ok ? blogRes.json() : [],
          guestRes.ok ? guestRes.json() : [],
        ]);
        setSearchResults({
          episodes: (episodes || []).slice(0, 5),
          blog: (blog || []).slice(0, 5),
          guests: (guests || []).slice(0, 5),
        });
      } catch {
        // ignore transient search errors
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const commands: Command[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Command[] = [];

    const matchesQuery = (label: string) => q.length === 0 || label.toLowerCase().includes(q);

    QUICK_ACTIONS.filter((item) => matchesQuery(item.label)).forEach((item) => {
      list.push({
        key: `quick-${item.href}`,
        label: item.label,
        icon: item.icon,
        group: 'Acciones Rápidas',
        onSelect: () => navigate(item.href),
      });
    });

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

    searchResults.episodes.forEach((ep) => {
      list.push({
        key: `ep-${ep._id}`,
        label: ep.title,
        sublabel: 'Episodio',
        icon: Radio,
        group: 'Episodios',
        onSelect: () => navigate(`/episodes/${ep._id}`),
      });
    });

    searchResults.blog.forEach((post) => {
      list.push({
        key: `blog-${post._id}`,
        label: post.title,
        sublabel: 'Blog',
        icon: FileText,
        group: 'Blog',
        onSelect: () => navigate(`/blog/${post._id}`),
      });
    });

    searchResults.guests.forEach((guest) => {
      list.push({
        key: `guest-${guest._id}`,
        label: guest.name,
        sublabel: 'Invitado',
        icon: UserCheck,
        group: 'Invitados',
        onSelect: () => navigate(`/guests/${guest._id}`),
      });
    });

    return list;
  }, [query, navGroups, searchResults]);

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
            placeholder="Buscar episodios, blog, invitados o navegar..."
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
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
                      {cmd.sublabel && <span className="text-[10px] text-zinc-500 font-mono shrink-0">{cmd.sublabel}</span>}
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
