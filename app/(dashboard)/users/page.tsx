'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  Search,
  Download,
  Mail,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Flame,
  Activity,
  UserCheck,
  UserX,
  ShieldAlert,
  X,
  AlertTriangle,
  ChevronRight,
  Filter
} from 'lucide-react';
import PermissionsEditor from '@/components/PermissionsEditor';
import { PermissionOverrides } from '@/lib/permissions';

interface UserItem {
  _id: string;
  name: string;
  email: string;
  picture?: string;
  bio?: string;
  role: 'user' | 'editor' | 'admin' | 'owner';
  permissions?: PermissionOverrides;
  newsletter?: boolean;
  listeningTime?: number;
  currentStreak?: number;
  maxStreak?: number;
  favorites?: string[];
  lastLogin?: string;
  lastActiveAt?: string;
  createdAt: string;
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [newsletterFilter, setNewsletterFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Modals state
  const [selectedUserForView, setSelectedUserForView] = useState<UserItem | null>(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserItem | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'editor' | 'admin' | 'owner'>('user');
  const [editNewsletter, setEditNewsletter] = useState(true);
  const [editPermissions, setEditPermissions] = useState<PermissionOverrides>({});
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const [editSeconds, setEditSeconds] = useState('0');
  const [saving, setSaving] = useState(false);

  // Delete & Bulk state
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCurrentRole(data?.user?.role || null))
      .catch(() => setCurrentRole(null));
  }, []);

  // Metric computations
  const now = useMemo(() => new Date(), []);
  const thirtyDaysAgo = useMemo(() => new Date(now.getTime() - 30 * 24 * 3600 * 1000), [now]);
  const sevenDaysAgo = useMemo(() => new Date(now.getTime() - 7 * 24 * 3600 * 1000), [now]);

  const totalUsers = users.length;
  const active30d = useMemo(
    () => users.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt) >= thirtyDaysAgo).length,
    [users, thirtyDaysAgo]
  );
  const subscribedCount = useMemo(() => users.filter((u) => u.newsletter).length, [users]);
  const new7d = useMemo(() => users.filter((u) => new Date(u.createdAt) >= sevenDaysAgo).length, [users, sevenDaysAgo]);
  const totalListeningSeconds = useMemo(
    () => users.reduce((acc, u) => acc + (u.listeningTime || 0), 0),
    [users]
  );
  const avgListeningSeconds = totalUsers > 0 ? Math.round(totalListeningSeconds / totalUsers) : 0;

  function fmtTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h >= 100) return `${h.toLocaleString('es-ES')}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function fmtNum(n: number): string {
    return (n || 0).toLocaleString('es-ES');
  }

  // Filtering and sorting
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const query = search.trim().toLowerCase();
        if (query) {
          const matchName = u.name?.toLowerCase().includes(query);
          const matchEmail = u.email?.toLowerCase().includes(query);
          const matchId = u._id?.toString().includes(query);
          if (!matchName && !matchEmail && !matchId) return false;
        }
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (newsletterFilter === 'subscribed' && !u.newsletter) return false;
        if (newsletterFilter === 'unsubscribed' && u.newsletter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'listening') return (b.listeningTime || 0) - (a.listeningTime || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // newest
      });
  }, [users, search, roleFilter, newsletterFilter, sortBy]);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredUsers.map((u) => u._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const openEditModal = (user: UserItem) => {
    setSelectedUserForEdit(user);
    setEditName(user.name || '');
    setEditEmail(user.email || '');
    setEditBio(user.bio || '');
    setEditRole(user.role || 'user');
    setEditNewsletter(!!user.newsletter);
    setEditPermissions(user.permissions || {});

    const totalSecs = user.listeningTime || 0;
    setEditHours(Math.floor(totalSecs / 3600).toString());
    setEditMinutes(Math.floor((totalSecs % 3600) / 60).toString());
    setEditSeconds((totalSecs % 60).toString());
  };

  // Owners are never restricted, and only an owner may retune an admin's reach.
  const canEditPermissions =
    !!selectedUserForEdit &&
    selectedUserForEdit.role !== 'owner' &&
    (selectedUserForEdit.role !== 'admin' || currentRole === 'owner');

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setSaving(true);
    setActionError(null);

    const h = parseInt(editHours, 10) || 0;
    const m = parseInt(editMinutes, 10) || 0;
    const s = parseInt(editSeconds, 10) || 0;
    const calculatedListeningTime = h * 3600 + m * 60 + s;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserForEdit._id,
          name: editName,
          email: editEmail,
          bio: editBio,
          role: editRole,
          newsletter: editNewsletter,
          listeningTime: calculatedListeningTime,
          ...(canEditPermissions ? { permissions: editPermissions } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setActionError(json.error || 'Error al guardar cambios');
      } else {
        setSelectedUserForEdit(null);
        fetchUsers(true);
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!userToDelete) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users?id=${userToDelete._id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setActionError(json.error || 'No se pudo eliminar el usuario');
      } else {
        setUserToDelete(null);
        setSelectedIds((prev) => prev.filter((id) => id !== userToDelete._id));
        fetchUsers(true);
      }
    } catch (err) {
      console.error(err);
      setActionError('Error de red al eliminar usuario');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedIds }),
      });
      const json = await res.json();
      if (json.errors && json.errors.length > 0) {
        setActionError(json.errors.join('; '));
      }
      setShowBulkConfirm(false);
      setSelectedIds([]);
      fetchUsers(true);
    } catch (err) {
      console.error(err);
      setActionError('Error de red en la eliminación masiva');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredUsers.length === 0) return;
    const headers = ['ID', 'Nombre', 'Email', 'Rol', 'Newsletter', 'TiempoEscuchado_Seg', 'RachaActual', 'FechaRegistro'];
    const rows = filteredUsers.map((u) => [
      u._id,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email.replace(/"/g, '""')}"`,
      u.role,
      u.newsletter ? 'Sí' : 'No',
      u.listeningTime || 0,
      u.currentStreak || 0,
      new Date(u.createdAt).toISOString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `veredillasfm-usuarios-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-zinc-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando gestión de usuarios...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
            <span>Gestión de Usuarios</span>
            <Users className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Administración completa de cuentas, roles, permisos y suscripciones de Veredillas FM.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
            title="Exportar listado a CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => fetchUsers()}
            disabled={refreshing}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STATS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Total */}
        <div className="bg-zinc-900/70 border border-indigo-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Total Usuarios</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{fmtNum(totalUsers)}</div>
          <div className="text-[10px] text-indigo-400 font-medium">Registrados en total</div>
        </div>

        {/* Activos 30d */}
        <div className="bg-zinc-900/70 border border-emerald-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Activos 30d</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{fmtNum(active30d)}</div>
          <div className="text-[10px] text-emerald-400 font-medium">
            {totalUsers > 0 ? Math.round((active30d / totalUsers) * 100) : 0}% de actividad
          </div>
        </div>

        {/* Suscritos */}
        <div className="bg-zinc-900/70 border border-sky-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Newsletter</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{fmtNum(subscribedCount)}</div>
          <div className="text-[10px] text-sky-400 font-medium">
            {totalUsers > 0 ? Math.round((subscribedCount / totalUsers) * 100) : 0}% suscritos
          </div>
        </div>

        {/* Nuevos 7d */}
        <div className="bg-zinc-900/70 border border-amber-900/40 rounded-xl p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Nuevos 7d</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">+{fmtNum(new7d)}</div>
          <div className="text-[10px] text-amber-400 font-medium">Esta última semana</div>
        </div>

        {/* Tiempo Total */}
        <div className="bg-zinc-900/70 border border-purple-900/40 rounded-xl p-4 space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold">Tiempo Acumulado</span>
          <div className="text-2xl font-black text-zinc-100 font-mono">{fmtTime(totalListeningSeconds)}</div>
          <div className="text-[10px] text-purple-400 font-medium">{fmtTime(avgListeningSeconds)} promedio</div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="all">Todos los roles</option>
            <option value="user">Usuario</option>
            <option value="editor">Editor</option>
            <option value="admin">Administrador</option>
            <option value="owner">Propietario</option>
          </select>

          {/* Newsletter Filter */}
          <select
            value={newsletterFilter}
            onChange={(e) => setNewsletterFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="all">Newsletter: Todos</option>
            <option value="subscribed">Suscritos</option>
            <option value="unsubscribed">No suscritos</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="name">Nombre A-Z</option>
            <option value="listening">Más tiempo escuchado</option>
          </select>
        </div>

        <div className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/80 px-2.5 py-1 rounded-lg shrink-0 text-center">
          <span className="font-bold text-zinc-100">{filteredUsers.length}</span> usuarios
        </div>
      </div>

      {/* ── BULK ACTIONS BAR (When items selected) ── */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-950/80 border border-indigo-800 p-3 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold bg-indigo-600 text-white px-2 py-0.5 rounded text-[11px]">
              {selectedIds.length}
            </span>
            <span className="text-indigo-200">usuarios seleccionados</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkConfirm(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1 rounded-lg font-medium transition flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Selección</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="text-indigo-300 hover:text-white px-2 py-1 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── USERS TABLE ── */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl">
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <UserX className="w-8 h-8 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-300">No se encontraron usuarios</p>
            <p className="text-xs font-mono text-zinc-500">Prueba a modificar los filtros o término de búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-950/80 border-b border-zinc-800/80 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredUsers.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600"
                    />
                  </th>
                  <th className="p-3.5">Usuario</th>
                  <th className="p-3.5 hidden md:table-cell">Email</th>
                  <th className="p-3.5 text-center">Rol</th>
                  <th className="p-3.5 text-center hidden sm:table-cell">Registro</th>
                  <th className="p-3.5 text-center hidden lg:table-cell">Actividad</th>
                  <th className="p-3.5 hidden xl:table-cell">Tiempo Escuchado</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/60">
                {filteredUsers.map((user) => {
                  const daysAgo = user.lastActiveAt
                    ? Math.floor((now.getTime() - new Date(user.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
                    : -1;
                  const isActive = daysAgo >= 0 && daysAgo <= 7;
                  const isInactive = daysAgo > 30 || daysAgo === -1;
                  const isSelected = selectedIds.includes(user._id);

                  return (
                    <tr
                      key={user._id}
                      className={`hover:bg-zinc-800/40 transition ${isSelected ? 'bg-indigo-950/30' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(user._id)}
                          className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600"
                        />
                      </td>

                      {/* User Cell */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {user.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={user.picture}
                                alt={user.name}
                                className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-xs flex items-center justify-center">
                                {user.name?.charAt(0)}
                              </div>
                            )}
                            {/* Status Dot */}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                                isActive ? 'bg-emerald-500' : isInactive ? 'bg-zinc-600' : 'bg-amber-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{user.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate md:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="p-3.5 hidden md:table-cell font-mono text-zinc-400 truncate max-w-[200px]">
                        {user.email}
                      </td>

                      {/* Role Badge */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${
                            user.role === 'owner'
                              ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                              : user.role === 'admin'
                              ? 'bg-purple-950/60 border-purple-800 text-purple-300'
                              : user.role === 'editor'
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                              : 'bg-zinc-800/60 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="p-3.5 text-center hidden sm:table-cell font-mono text-zinc-400 text-[11px]">
                        {new Date(user.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>

                      {/* Activity */}
                      <td className="p-3.5 text-center hidden lg:table-cell font-mono">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={isActive ? 'text-emerald-400' : isInactive ? 'text-zinc-500' : 'text-amber-400'}>
                            {daysAgo === 0 ? 'Hoy' : daysAgo > 0 ? `Hace ${daysAgo}d` : 'Nunca'}
                          </span>
                          {(user.currentStreak || 0) > 0 && (
                            <span className="text-[9px] bg-rose-950 text-rose-400 border border-rose-800 px-1 rounded flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5" /> {user.currentStreak}d
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Listening Time */}
                      <td className="p-3.5 hidden xl:table-cell font-mono font-bold text-amber-400">
                        {fmtTime(user.listeningTime || 0)}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedUserForView(user)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950 rounded transition"
                            title="Editar usuario"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950 rounded transition"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EDIT USER MODAL ── */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setSelectedUserForEdit(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                <span>Editar Usuario</span>
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-1">ID: {selectedUserForEdit._id}</p>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Nombre</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Biografía</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Rol</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="user">Usuario</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                    <option value="owner">Propietario</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-400 font-medium">Newsletter</label>
                  <label className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editNewsletter}
                      onChange={(e) => setEditNewsletter(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 accent-indigo-600"
                    />
                    <span className="text-zinc-200">Suscrito</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Tiempo de Escucha Acumulado</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      value={editHours}
                      onChange={(e) => setEditHours(e.target.value)}
                      className="w-full bg-transparent text-zinc-200 focus:outline-none font-mono"
                    />
                    <span className="text-zinc-500 font-mono text-[10px]">H</span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value)}
                      className="w-full bg-transparent text-zinc-200 focus:outline-none font-mono"
                    />
                    <span className="text-zinc-500 font-mono text-[10px]">M</span>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editSeconds}
                      onChange={(e) => setEditSeconds(e.target.value)}
                      className="w-full bg-transparent text-zinc-200 focus:outline-none font-mono"
                    />
                    <span className="text-zinc-500 font-mono text-[10px]">S</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-zinc-400 font-medium flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Permisos por sección</span>
                  </label>
                </div>

                {canEditPermissions ? (
                  <PermissionsEditor
                    role={editRole}
                    overrides={editPermissions}
                    onChange={setEditPermissions}
                  />
                ) : (
                  <p className="text-[11px] text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                    {selectedUserForEdit.role === 'owner'
                      ? 'El propietario siempre conserva acceso completo a todas las secciones.'
                      : 'Solo el propietario puede ajustar los permisos de un administrador.'}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedUserForEdit(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-indigo-600/20"
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW USER MODAL ── */}
      {selectedUserForView && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setSelectedUserForView(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 border-b border-zinc-800 pb-4">
              {selectedUserForView.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedUserForView.picture}
                  alt={selectedUserForView.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500/50"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-indigo-950 border-2 border-indigo-800 text-indigo-300 font-bold text-xl flex items-center justify-center">
                  {selectedUserForView.name?.charAt(0)}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-zinc-100">{selectedUserForView.name}</h3>
                <p className="text-xs text-zinc-400 font-mono">{selectedUserForView.email}</p>
                <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  Rol: {selectedUserForView.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Tiempo de Escucha</span>
                <p className="font-mono font-bold text-amber-400 text-base">
                  {fmtTime(selectedUserForView.listeningTime || 0)}
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Racha Actual / Máx</span>
                <p className="font-mono font-bold text-rose-400 text-base flex items-center gap-1">
                  <Flame className="w-4 h-4" /> {selectedUserForView.currentStreak || 0}d /{' '}
                  {selectedUserForView.maxStreak || 0}d
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Favoritos Guardados</span>
                <p className="font-mono font-bold text-purple-400 text-base">
                  {selectedUserForView.favorites?.length || 0} episodios
                </p>
              </div>

              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                <span className="text-zinc-500 font-mono text-[10px] uppercase">Newsletter</span>
                <p className="font-mono font-bold text-emerald-400 text-base flex items-center gap-1">
                  {selectedUserForView.newsletter ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <UserX className="w-4 h-4 text-zinc-500" />
                  )}
                  {selectedUserForView.newsletter ? 'Suscrito' : 'No suscrito'}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 font-mono space-y-1 border-t border-zinc-800 pt-3">
              <p>Registro: {new Date(selectedUserForView.createdAt).toLocaleDateString('es-ES')}</p>
              <p>
                Último acceso:{' '}
                {selectedUserForView.lastLogin
                  ? new Date(selectedUserForView.lastLogin).toLocaleString('es-ES')
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE SINGLE CONFIRM MODAL ── */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-100">¿Eliminar usuario?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Esta acción eliminará la cuenta de <strong className="text-zinc-200">{userToDelete.name}</strong> ({userToDelete.email}).
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setUserToDelete(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSingle}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg shadow-rose-600/20"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK DELETE CONFIRM MODAL ── */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-zinc-100">¿Eliminar {selectedIds.length} usuarios?</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Se eliminarán permanentemente los usuarios seleccionados. Esta acción no se puede deshacer.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-xs font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-lg shadow-rose-600/20"
              >
                {isBulkDeleting ? 'Eliminando...' : 'Sí, Eliminar Todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
