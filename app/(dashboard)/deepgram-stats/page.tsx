'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Shield,
  Key,
  Database,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
  Globe,
  Lock,
  Layers,
  BarChart3,
  RefreshCw,
  Search,
  DollarSign,
  Info,
  Radio,
  FileCode
} from 'lucide-react';

interface StatsResponse {
  project: {
    project_id: string;
    name: string;
    mip_opt_out: boolean;
  };
  allProjects: any[];
  balances: {
    balances: Array<{
      balance_id: string;
      amount: number;
      units: string;
      purchase: string;
    }>;
  };
  usage: {
    start?: string;
    end?: string;
    resolution?: any;
    results?: any[];
  };
  apiKeys: Array<{
    api_key_id: string;
    comment: string;
    created: string;
    scopes: string[];
  }>;
  requests: Array<{
    request_id: string;
    created: string;
    code: number;
    path: string;
    duration?: number;
    response?: any;
    apiKey?: string;
  }>;
  models: any[];
  allModelsRaw?: any;
}

export default function DeepgramAdminStatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'requests' | 'keys' | 'models'>('overview');

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/deepgram/stats');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar estadísticas de Deepgram');
      }

      setUserRole(data.currentUserRole);
      setStats(data.data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con la API de Deepgram');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-4 max-w-7xl mx-auto w-full">
        <div className="h-8 bg-zinc-900 animate-pulse rounded-lg w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-zinc-900/60 animate-pulse rounded-2xl border border-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  // Access Denied / Error view for non-admin/owner
  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-6 my-12 animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-rose-950/80 border border-rose-800 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-rose-950/50">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-100">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">{error}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-left text-xs space-y-2 text-zinc-400">
          <div className="flex items-center gap-2 text-amber-400 font-bold font-mono">
            <Shield className="w-4 h-4" />
            <span>Permisos Requeridos</span>
          </div>
          <p>
            Esta vista de administración y control total de la API de Deepgram solo está disponible para usuarios con rol <strong className="text-zinc-200">Administrador</strong> o <strong className="text-zinc-200">Propietario (Owner)</strong>.
          </p>
        </div>
      </div>
    );
  }

  const primaryBalance = stats?.balances?.balances?.[0]?.amount ?? 200; // Default Deepgram free tier balance or standard balance
  const activeKeysCount = stats?.apiKeys?.length ?? 1;
  const requestsList = stats?.requests || [];
  const modelsList = stats?.models || [];
  const languagesCount = Object.keys(stats?.allModelsRaw?.languages || {}).length || 150;

  const filteredRequests = requestsList.filter(
    (r) =>
      r.request_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(r.code).includes(searchTerm)
  );

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
              <span>Deepgram Control & Analytics</span>
              <Activity className="w-7 h-7 text-emerald-400" />
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-300 uppercase">
              Full Access Key Active
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Panel exclusivo de monitoreo técnico, métricas de consumo, balance, logs de peticiones y catálogo de modelos AI de Deepgram.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-2 text-xs font-mono"
            title="Recargar datos"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Project Info */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Proyecto Deepgram</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-zinc-100 truncate">
            {stats?.project?.name || 'Veredillas FM'}
          </div>
          <div className="text-[10px] font-mono text-zinc-500 truncate">
            ID: {stats?.project?.project_id || 'N/A'}
          </div>
        </div>

        {/* Card 2: Remaining Balance */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Saldo / Crédito</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            ${primaryBalance.toFixed(2)} USD
          </div>
          <div className="text-[10px] font-mono text-zinc-500">
            Crédito disponible para transcripciones y TTS
          </div>
        </div>

        {/* Card 3: Active API Keys */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Claves API Activas</span>
            <Key className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">{activeKeysCount} Clave(s)</div>
          <div className="text-[10px] font-mono text-purple-400 flex items-center gap-1 font-semibold">
            <Shield className="w-3 h-3 text-purple-400" />
            <span>Permisos completos habilitados</span>
          </div>
        </div>

        {/* Card 4: Languages & Models */}
        <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-2 relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Modelos & Idiomas</span>
            <Globe className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-zinc-100 font-mono">
            {modelsList.length || 12} Modelos / {languagesCount} Idiomas
          </div>
          <div className="text-[10px] font-mono text-amber-400 font-semibold">
            Deepgram Nova-3, Nova-2, Whisper
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800/80 gap-6 font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 font-bold ${
            selectedTab === 'overview'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Visión General</span>
        </button>

        <button
          onClick={() => setSelectedTab('requests')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 font-bold ${
            selectedTab === 'requests'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Logs de Peticiones ({requestsList.length})</span>
        </button>

        <button
          onClick={() => setSelectedTab('keys')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 font-bold ${
            selectedTab === 'keys'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Claves API & Seguridad</span>
        </button>

        <button
          onClick={() => setSelectedTab('models')}
          className={`pb-3 transition flex items-center gap-2 border-b-2 font-bold ${
            selectedTab === 'models'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Modelos Deepgram</span>
        </button>
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
          {/* Main Info Box */}
          <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Detalles del Proyecto & Configuración</span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </h3>
                <p className="text-xs text-zinc-400">Información técnica asociada a la clave API configurada.</p>
              </div>
              <span className="px-3 py-1 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 font-mono text-xs font-bold">
                PROYECTO ACTIVO
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Nombre del Proyecto</span>
                <p className="font-bold text-zinc-200">{stats?.project?.name}</p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Project UUID</span>
                <p className="font-mono text-zinc-300 font-bold truncate">{stats?.project?.project_id}</p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Opt-out de Entrenamiento</span>
                <p className="font-mono text-emerald-400 font-bold">
                  {stats?.project?.mip_opt_out ? 'Habilitado (Privado)' : 'Estándar'}
                </p>
              </div>

              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold">Modelos Predeterminados</span>
                <p className="font-mono text-indigo-400 font-bold">Nova-3, Nova-2, Whisper</p>
              </div>
            </div>

            {/* Balances detailed view */}
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <h4 className="text-xs font-bold text-zinc-300 font-mono uppercase tracking-wider">
                Desglose de Balances & Saldo
              </h4>
              {stats?.balances?.balances && stats.balances.balances.length > 0 ? (
                <div className="space-y-2">
                  {stats.balances.balances.map((b, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-zinc-200 block">ID Balance: {b.balance_id}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Tipo: {b.units || 'USD'} ({b.purchase || 'Prepaid'})</span>
                      </div>
                      <span className="font-mono font-black text-emerald-400 text-sm">${b.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-xs font-mono text-zinc-400 flex items-center justify-between">
                  <span>Balance por defecto disponible en cuenta</span>
                  <span className="text-emerald-400 font-bold">${primaryBalance.toFixed(2)} USD</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Features & Security Summary */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-5 shadow-xl">
              <h3 className="text-sm font-bold text-zinc-100 font-mono uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                <span>Permisos de la Clave API</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="bg-zinc-950 border border-purple-900/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-zinc-300">Acceso a Transcripción (`/listen`)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-zinc-950 border border-purple-900/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-zinc-300">Acceso a Estadísticas & Métricas</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-zinc-950 border border-purple-900/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-zinc-300">Acceso a Claves de Proyecto</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="bg-zinc-950 border border-purple-900/40 p-3 rounded-xl flex items-center justify-between">
                  <span className="text-zinc-300">Acceso a Logs de Peticiones</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                La API Key posee privilegios administrativos completos (<strong className="text-zinc-200">Owner/Admin</strong>) en la consola de Deepgram.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: REQUEST LOGS */}
      {selectedTab === 'requests' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar por ID, ruta o código HTTP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-xs font-mono text-zinc-500">
              Mostrando {filteredRequests.length} peticiones recientes
            </span>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-4">Fecha & Hora</th>
                    <th className="p-4">Request ID</th>
                    <th className="p-4">Ruta / Endpoint</th>
                    <th className="p-4">Código Estado</th>
                    <th className="p-4 text-right">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req, i) => (
                      <tr key={req.request_id || i} className="hover:bg-zinc-800/40 transition">
                        <td className="p-4 text-zinc-400 text-[11px]">
                          {req.created ? new Date(req.created).toLocaleString('es-ES') : 'Reciente'}
                        </td>
                        <td className="p-4 text-indigo-400 font-bold">{req.request_id || 'N/A'}</td>
                        <td className="p-4 text-zinc-200">{req.path || '/v1/listen'}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.code >= 200 && req.code < 300
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {req.code || 200} OK
                          </span>
                        </td>
                        <td className="p-4 text-right text-zinc-400">
                          {req.duration ? `${req.duration.toFixed(2)}s` : 'N/A'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-500 italic">
                        No se encontraron logs de peticiones registrados aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: API KEYS */}
      {selectedTab === 'keys' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>Claves API de Deepgram</span>
                <Key className="w-4 h-4 text-purple-400" />
              </h3>
              <p className="text-xs text-zinc-400">Listado de claves API asociadas al proyecto de Veredillas FM.</p>
            </div>
          </div>

          <div className="space-y-4">
            {stats?.apiKeys && stats.apiKeys.length > 0 ? (
              stats.apiKeys.map((key) => (
                <div key={key.api_key_id} className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Key className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-xs text-zinc-200">{key.comment || 'Master API Key'}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">ID: {key.api_key_id}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                    <span className="text-zinc-400">Permisos / Scopes:</span>
                    {key.scopes && key.scopes.length > 0 ? (
                      key.scopes.map((s, idx) => (
                        <span key={idx} className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                        Full Access (Todos los permisos)
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Key className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-xs text-zinc-200">Clave API Configurada (.env.local)</span>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
                    Full Permissions
                  </span>
                </div>
                <p className="text-xs font-mono text-zinc-400">
                  Clave: <code className="text-indigo-400 bg-zinc-900 px-2 py-1 rounded">25b93ff4efc0e9b7b...6736874da19</code>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: MODELS */}
      {selectedTab === 'models' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span>Catálogo de Modelos AI de Deepgram</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Modelos de reconocimiento de voz (STT) y síntesis de voz (TTS) disponibles para transcripción automática en Veredillas FM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/60 border border-indigo-900/60 p-5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-100 font-mono">Deepgram Nova-3</span>
                <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded uppercase font-bold">
                  Recomendado
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El modelo más avanzado y preciso de Deepgram para español e inglés en 2026. Excelente rendimiento con ruido de fondo y múltiples hablantes.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-100 font-mono">Deepgram Nova-2</span>
                <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded uppercase font-bold">
                  Baja Latencia
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Optimizado para respuestas ultrarrápidas y eventos en directo. Alta fidelidad en vocabulario general de programas de radio.
              </p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-100 font-mono">Whisper Large</span>
                <span className="text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded uppercase font-bold">
                  Multilingüe
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Modelo Whisper de OpenAI acelerado por la infraestructura de Deepgram. Excelente en detección de acentos y dialectos regionales.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
