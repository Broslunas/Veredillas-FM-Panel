'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Radio,
  FileText,
  Users,
  HardDrive,
  LogOut,
  Shield,
  Loader2,
  Plus,
  BarChart3,
} from 'lucide-react';

interface UserSession {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: 'admin' | 'owner' | 'user';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        if (!data.user) {
          router.push('/login');
          return;
        }

        if (data.user.role !== 'admin' && data.user.role !== 'owner') {
          router.push('/unauthorized');
          return;
        }

        setUser(data.user);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-mono">Cargando panel...</span>
      </div>
    );
  }

  const navItems = [
    { label: 'Visión General', href: '/', icon: LayoutDashboard },
    { label: 'Analíticas', href: '/user-stats', icon: BarChart3 },
    { label: 'Episodios', href: '/episodes', icon: Radio },
    { label: 'Blog', href: '/blog', icon: FileText },
    { label: 'Invitados', href: '/guests', icon: Users },
    { label: 'Medios R2', href: '/media', icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* MINIMALIST SIDEBAR */}
      <aside className="w-full md:w-64 bg-zinc-900/60 border-r border-zinc-800/80 flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
              V
            </div>
            <div>
              <span className="font-bold text-sm text-zinc-100 block leading-tight">Veredillas FM</span>
              <span className="text-[10px] font-mono text-zinc-500 block uppercase">Panel Admin</span>
            </div>
          </Link>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase">
            {user?.role}
          </span>
        </div>

        {/* Quick Create Action */}
        <div className="p-3">
          <Link
            href="/episodes/new"
            className="w-full bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 text-zinc-200 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Nuevo Episodio</span>
          </Link>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                {user?.name?.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
