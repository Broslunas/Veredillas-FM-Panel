'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Radio, FileText, X } from 'lucide-react';

interface CalendarItem {
  type: 'episode' | 'blog';
  id: string;
  title: string;
  status?: string;
  isPremiere?: boolean;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [epRes, blogRes] = await Promise.all([fetch('/api/episodes'), fetch('/api/blog')]);
        setEpisodes(epRes.ok ? await epRes.json() : []);
        setBlogPosts(blogRes.ok ? await blogRes.json() : []);
      } catch (err) {
        console.error('Error loading calendar data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const addItem = (dateStr: string, item: CalendarItem) => {
      if (!dateStr) return;
      const key = dateKey(new Date(dateStr));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };

    episodes.forEach((ep) =>
      addItem(ep.pubDate, { type: 'episode', id: ep._id, title: ep.title, status: ep.status, isPremiere: ep.isPremiere })
    );
    blogPosts.forEach((post) => addItem(post.pubDate, { type: 'blog', id: post._id, title: post.title }));

    return map;
  }, [episodes, blogPosts]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    // Monday-first grid: getDay() is 0(Sun)-6(Sat) -> convert to 0(Mon)-6(Sun)
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startOffset);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [year, month]);

  const today = dateKey(new Date());
  const selectedItems = selectedDay ? itemsByDay.get(selectedDay) || [] : [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            <span>Calendario Editorial</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Episodios y publicaciones de blog programados, incluyendo borradores
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="text-xs font-medium px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 rounded-lg transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-zinc-200 font-mono ml-2 w-36">
            {MONTH_NAMES[month]} {year}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-mono">Cargando calendario...</span>
        </div>
      ) : (
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-800/80">
            {WEEKDAYS.map((day) => (
              <div key={day} className="p-2 text-center text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((d) => {
              const key = dateKey(d);
              const items = itemsByDay.get(key) || [];
              const isCurrentMonth = d.getMonth() === month;
              const isToday = key === today;

              return (
                <button
                  key={key}
                  onClick={() => items.length > 0 && setSelectedDay(key)}
                  disabled={items.length === 0}
                  className={`min-h-[84px] p-2 border-b border-r border-zinc-800/60 text-left align-top transition flex flex-col gap-1 ${
                    isCurrentMonth ? 'bg-transparent' : 'bg-zinc-950/40'
                  } ${items.length > 0 ? 'hover:bg-zinc-800/40 cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`text-xs font-mono ${
                      isToday
                        ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                        : isCurrentMonth
                        ? 'text-zinc-300'
                        : 'text-zinc-600'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {items.slice(0, 2).map((item) => (
                      <span
                        key={`${item.type}-${item.id}`}
                        className={`text-[10px] font-mono truncate px-1.5 py-0.5 rounded ${
                          item.type === 'episode'
                            ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        }`}
                      >
                        {item.title}
                      </span>
                    ))}
                    {items.length > 2 && (
                      <span className="text-[10px] font-mono text-zinc-500">+{items.length - 2} más</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">{selectedDay}</h3>
              <button onClick={() => setSelectedDay(null)} className="text-zinc-500 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.type === 'episode' ? `/episodes/${item.id}` : `/blog/${item.id}`}
                  className="flex items-center gap-2.5 p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg hover:border-zinc-700 transition"
                >
                  {item.type === 'episode' ? (
                    <Radio className="w-4 h-4 text-indigo-400 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-xs text-zinc-200 truncate flex-1">{item.title}</span>
                  {item.status === 'draft' && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0">
                      Borrador
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
