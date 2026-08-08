'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Users,
  Smartphone,
  Monitor,
  Eye,
  Clock,
  Wifi,
  WifiOff,
  UserCheck,
  UserX,
  ExternalLink,
} from 'lucide-react';

interface Listener {
  _id: string;
  sessionId: string;
  lastSeen: string;
  path: string;
  userAgent?: string;
  userId?: string;
  name?: string;
  picture?: string;
}

export default function LiveActivityPage() {
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchListeners = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/live');
      const data = await res.json();
      setListeners(data.listeners || []);
      setCount(data.count || 0);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching live data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchListeners();
    const interval = setInterval(() => fetchListeners(true), 15000);
    return () => clearInterval(interval);
  }, [fetchListeners]);

  // KPI calculations
  const registeredCount = listeners.filter((l) => l.userId).length;
  const anonymousCount = listeners.filter((l) => !l.userId).length;
  const mobileCount = listeners.filter((l) => l.userAgent?.includes('Mobile')).length;
  const desktopCount = count - mobileCount;

  function getPathLabel(path: string) {
    if (!path) return '-';
    if (path === '/') return '🏠 Inicio';
    if (path.startsWith('/ep/')) {
      const slug = path.replace('/ep/', '').replace(/\/$/, '');
      return `🎙️ ${slug}`;
    }
    if (path === '/perfil') return '👤 Perfil';
    if (path === '/favoritos') return '❤️ Favoritos';
    if (path === '/blog') return '📝 Blog';
    if (path.startsWith('/blog/')) return '📝 Blog';
    if (path === '/dashboard') return '⚙️ Dashboard';
    if (path.startsWith('/dashboard')) return '⚙️ Dashboard';
    return path;
  }

  function getRelativeTime(isoStr: string) {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000));
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  function getDeviceInfo(ua?: string) {
    if (!ua) return { icon: <Monitor className="w-3.5 h-3.5 text-zinc-500" />, label: 'Desconocido' };
    if (ua.includes('Mobile'))
      return { icon: <Smartphone className="w-3.5 h-3.5 text-amber-400" />, label: 'Móvil' };
    return { icon: <Monitor className="w-3.5 h-3.5 text-sky-400" />, label: 'Escritorio' };
  }

  if (loading && listeners.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Activity className="w-8 h-8 animate-pulse text-emerald-500" />
        <span className="text-xs font-mono">Conectando con el monitor en vivo...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
            <span>Centro de Actividad en Vivo</span>
            <Activity className="w-6 h-6 text-emerald-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Usuarios activos en los últimos 5 minutos · Actualización cada 15s
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Umami Analytics Link */}
          <a
            href="https://analytics.broslunas.com/share/EbieAikRrucZqa03"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition border border-indigo-500/50"
            title="Ver estadísticas completas en Umami Analytics"
          >
            <span>Ver Estadísticas Completas</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Live Badge */}
          <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-bold text-emerald-300 font-mono">{count}</span>
            <span className="text-xs text-emerald-400/70">Online</span>
          </div>

          <button
            onClick={() => fetchListeners()}
            disabled={refreshing}
            className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
            title="Refrescar ahora"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-zinc-900/60 border border-emerald-900/40 p-4 rounded-2xl text-center space-y-1">
          <Wifi className="w-5 h-5 text-emerald-400 mx-auto" />
          <span className="text-2xl font-black text-emerald-400 font-mono block">{count}</span>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Total Online</span>
        </div>

        <div className="bg-zinc-900/60 border border-indigo-900/40 p-4 rounded-2xl text-center space-y-1">
          <UserCheck className="w-5 h-5 text-indigo-400 mx-auto" />
          <span className="text-2xl font-black text-indigo-400 font-mono block">{registeredCount}</span>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Registrados</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl text-center space-y-1">
          <UserX className="w-5 h-5 text-zinc-400 mx-auto" />
          <span className="text-2xl font-black text-zinc-300 font-mono block">{anonymousCount}</span>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Anónimos</span>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl text-center space-y-1">
          <Smartphone className="w-5 h-5 text-amber-400 mx-auto" />
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-black text-amber-400 font-mono">{mobileCount}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-lg font-black text-sky-400 font-mono">{desktopCount}</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Móvil / Desktop</span>
        </div>
      </div>

      {/* ── LISTENERS TABLE ── */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        {listeners.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <WifiOff className="w-10 h-10 mx-auto text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-300">No hay oyentes activos</p>
            <p className="text-xs font-mono text-zinc-500">
              Cuando alguien visite la web, aparecerá aquí en tiempo real.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Usuario / Sesión
                  </th>
                  <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Página Actual
                  </th>
                  <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Última Actividad
                  </th>
                  <th className="text-left p-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    Dispositivo
                  </th>
                </tr>
              </thead>
              <tbody>
                {listeners.map((listener) => {
                  const device = getDeviceInfo(listener.userAgent);
                  return (
                    <tr
                      key={listener._id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition"
                    >
                      {/* User */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            {listener.userId && listener.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={listener.picture}
                                alt={listener.name || ''}
                                className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                                {listener.name ? listener.name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full"></span>
                          </div>

                          <div className="min-w-0">
                            {listener.userId ? (
                              <>
                                <p className="text-xs font-semibold text-zinc-200 truncate">
                                  {listener.name || 'Usuario'}
                                </p>
                                <p className="text-[10px] font-mono text-zinc-500 truncate">
                                  {listener.userId.substring(0, 12)}...
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-xs font-medium text-zinc-400 italic">Anónimo</p>
                                <p className="text-[10px] font-mono text-zinc-600 truncate">
                                  {listener.sessionId.substring(0, 10)}...
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Path */}
                      <td className="p-4">
                        <span className="bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-lg text-[11px] text-zinc-300 font-medium">
                          {getPathLabel(listener.path)}
                        </span>
                      </td>

                      {/* Last Seen */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-zinc-400">
                          <Clock className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="font-mono text-[11px] font-bold">
                            {getRelativeTime(listener.lastSeen)} ago
                          </span>
                        </div>
                      </td>

                      {/* Device */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {device.icon}
                          <span className="text-[11px] text-zinc-400">{device.label}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with refresh info */}
        <div className="px-4 py-2.5 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-600">
            Auto-refresh: 15s · TTL: 5min
          </span>
          <span className="text-[10px] font-mono text-zinc-600">
            Último refresh: {lastRefresh.toLocaleTimeString('es-ES')}
          </span>
        </div>
      </div>
    </div>
  );
}
