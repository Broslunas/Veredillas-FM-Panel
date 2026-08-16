/**
 * Granular per-section permissions.
 *
 * Each role carries a default permission matrix; individual users can receive
 * overrides stored in `User.permissions`. The effective permission for a user
 * is `roleDefault` unless an override exists for that section.
 *
 * Owners always get full access — their overrides are ignored so nobody can
 * lock the account that manages every other account out of the panel.
 */

export type Role = 'user' | 'editor' | 'admin' | 'owner';
export type PermissionLevel = 'none' | 'read' | 'write';

export const PERMISSION_LEVELS: PermissionLevel[] = ['none', 'read', 'write'];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  none: 'Sin acceso',
  read: 'Solo lectura',
  write: 'Edición',
};

export interface SectionDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
}

/**
 * Sections mirror what the sidebar exposes, plus two cross-cutting ones
 * (`media` and `ai`) that have no menu entry but are used from the editors.
 */
export const SECTIONS = [
  {
    key: 'episodes',
    label: 'Episodios',
    group: 'Contenido',
    description: 'Crear y editar episodios, transcripciones y clips',
  },
  { key: 'blog', label: 'Blog', group: 'Contenido', description: 'Artículos y noticias del blog' },
  { key: 'gallery', label: 'Galería', group: 'Contenido', description: 'Categorías e imágenes de la galería' },
  { key: 'youtube', label: 'YouTube Studio', group: 'Contenido', description: 'Vídeos, playlists y subidas a YouTube' },
  { key: 'social', label: 'Social Publisher', group: 'Contenido', description: 'Highlights Studio y publicación en redes' },
  { key: 'live', label: 'En Vivo', group: 'Contenido', description: 'Emisión en directo y su estado' },
  { key: 'guests', label: 'Invitados', group: 'Comunidad', description: 'Fichas de invitados y autorizaciones' },
  { key: 'team', label: 'Equipo', group: 'Comunidad', description: 'Miembros del equipo por curso' },
  { key: 'comments', label: 'Comentarios', group: 'Comunidad', description: 'Moderación de comentarios del sitio y YouTube' },
  { key: 'interviews', label: 'Entrevistas', group: 'Comunidad', description: 'Solicitudes de entrevista recibidas' },
  { key: 'users', label: 'Usuarios', group: 'Administración', description: 'Cuentas, roles y permisos' },
  { key: 'trash', label: 'Papelera', group: 'Administración', description: 'Restaurar o eliminar definitivamente' },
  { key: 'media', label: 'Archivos R2', group: 'Almacenamiento', description: 'Subir y listar archivos usados en los editores' },
  { key: 'buckets', label: 'Buckets R2', group: 'Almacenamiento', description: 'Configurar buckets y explorar su contenido' },
  { key: 'ai', label: 'IA (Gemini y doblaje)', group: 'Herramientas', description: 'Generación con Gemini, transcripción y doblaje' },
  { key: 'analytics', label: 'Analíticas', group: 'Métricas', description: 'Estadísticas de escucha y audiencia' },
  { key: 'deepgram', label: 'Deepgram Admin', group: 'Métricas', description: 'Consumo y costes de la API de Deepgram' },
  { key: 'audit', label: 'Registro de Auditoría', group: 'Métricas', description: 'Historial de acciones del panel' },
] as const satisfies readonly SectionDefinition[];

export type PermissionSection = (typeof SECTIONS)[number]['key'];

export const SECTION_KEYS = SECTIONS.map((section) => section.key) as PermissionSection[];

export type PermissionMap = Record<PermissionSection, PermissionLevel>;
export type PermissionOverrides = Partial<Record<PermissionSection, PermissionLevel>>;

function fill(level: PermissionLevel): PermissionMap {
  return Object.fromEntries(SECTION_KEYS.map((key) => [key, level])) as PermissionMap;
}

/**
 * Role baselines. `editor` reproduces the access editors had before granular
 * permissions existed, so upgrading doesn't silently change anyone's reach.
 */
export const ROLE_DEFAULTS: Record<Role, PermissionMap> = {
  owner: fill('write'),
  admin: fill('write'),
  editor: {
    ...fill('write'),
    users: 'none',
    buckets: 'none',
    deepgram: 'none',
    audit: 'none',
    analytics: 'read',
  },
  user: fill('none'),
};

export function resolvePermissions(role: Role, overrides?: PermissionOverrides | null): PermissionMap {
  const base = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.user;
  // Owners are intentionally not overridable.
  if (role === 'owner' || !overrides) return { ...base };

  const resolved = { ...base };
  for (const key of SECTION_KEYS) {
    const value = overrides[key];
    if (value && PERMISSION_LEVELS.includes(value)) {
      resolved[key] = value;
    }
  }
  return resolved;
}

const LEVEL_RANK: Record<PermissionLevel, number> = { none: 0, read: 1, write: 2 };

export function can(
  permissions: PermissionMap | null | undefined,
  section: PermissionSection,
  level: PermissionLevel = 'read'
): boolean {
  if (!permissions) return false;
  return LEVEL_RANK[permissions[section] ?? 'none'] >= LEVEL_RANK[level];
}

/** Drops unknown keys and invalid levels from user-supplied override payloads. */
export function sanitizeOverrides(input: unknown): PermissionOverrides {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const clean: PermissionOverrides = {};
  for (const key of SECTION_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && PERMISSION_LEVELS.includes(value as PermissionLevel)) {
      clean[key] = value as PermissionLevel;
    }
  }
  return clean;
}

/**
 * Route → section map. The longest matching prefix wins, so
 * `/api/r2/browse` resolves to `buckets` while `/api/r2/upload` stays `media`.
 */
const ROUTE_SECTIONS: { prefix: string; section: PermissionSection }[] = [
  { prefix: '/api/episodes', section: 'episodes' },
  { prefix: '/api/blog', section: 'blog' },
  { prefix: '/api/gallery', section: 'gallery' },
  { prefix: '/api/guests', section: 'guests' },
  { prefix: '/api/admin/send-authorization', section: 'guests' },
  { prefix: '/api/team', section: 'team' },
  { prefix: '/api/trash', section: 'trash' },
  { prefix: '/api/admin/users', section: 'users' },
  { prefix: '/api/admin/user-stats', section: 'analytics' },
  { prefix: '/api/admin/audit-log', section: 'audit' },
  { prefix: '/api/admin/buckets', section: 'buckets' },
  { prefix: '/api/r2/browse', section: 'buckets' },
  { prefix: '/api/r2/browse-unified', section: 'buckets' },
  { prefix: '/api/r2', section: 'media' },
  { prefix: '/api/admin/r2-presign', section: 'media' },
  { prefix: '/api/admin/r2-presign-download', section: 'media' },
  { prefix: '/api/admin/comments', section: 'comments' },
  { prefix: '/api/youtube/comments', section: 'comments' },
  { prefix: '/api/admin/interviews', section: 'interviews' },
  { prefix: '/api/admin/live', section: 'live' },
  { prefix: '/api/youtube/live', section: 'live' },
  { prefix: '/api/youtube', section: 'youtube' },
  { prefix: '/api/admin/buffer', section: 'social' },
  { prefix: '/api/admin/social-webhook', section: 'social' },
  { prefix: '/api/admin/deepgram/stats', section: 'deepgram' },
  { prefix: '/api/admin/deepgram', section: 'ai' },
  { prefix: '/api/admin/dubbing', section: 'ai' },
  { prefix: '/api/admin/gemini', section: 'ai' },
];

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Resolves which section+level an API request needs. Unmapped routes fall back
 * to `null`, meaning "any staff member with panel access".
 */
export function sectionForRequest(
  pathname: string,
  method: string
): { section: PermissionSection | null; level: PermissionLevel } {
  let match: { prefix: string; section: PermissionSection } | null = null;
  for (const entry of ROUTE_SECTIONS) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      if (!match || entry.prefix.length > match.prefix.length) match = entry;
    }
  }

  return {
    section: match?.section ?? null,
    level: READ_METHODS.has(method.toUpperCase()) ? 'read' : 'write',
  };
}

/** Sections a dashboard pathname belongs to, used to gate pages client-side. */
const PAGE_SECTIONS: { prefix: string; section: PermissionSection }[] = [
  { prefix: '/episodes', section: 'episodes' },
  { prefix: '/blog', section: 'blog' },
  { prefix: '/gallery', section: 'gallery' },
  { prefix: '/guests', section: 'guests' },
  { prefix: '/team', section: 'team' },
  { prefix: '/comments', section: 'comments' },
  { prefix: '/interviews', section: 'interviews' },
  { prefix: '/live', section: 'live' },
  { prefix: '/youtube', section: 'youtube' },
  { prefix: '/social-clips', section: 'social' },
  { prefix: '/buffer', section: 'social' },
  { prefix: '/users', section: 'users' },
  { prefix: '/trash', section: 'trash' },
  { prefix: '/user-stats', section: 'analytics' },
  { prefix: '/deepgram-stats', section: 'deepgram' },
  { prefix: '/admin/buckets', section: 'buckets' },
  { prefix: '/admin/audit-log', section: 'audit' },
  { prefix: '/admin/users', section: 'users' },
  { prefix: '/admin/comments', section: 'comments' },
  { prefix: '/admin/interviews', section: 'interviews' },
  { prefix: '/admin/live', section: 'live' },
  { prefix: '/admin/social-clips', section: 'social' },
  { prefix: '/admin/buffer', section: 'social' },
  { prefix: '/admin/user-stats', section: 'analytics' },
];

export function sectionForPage(pathname: string): PermissionSection | null {
  let match: { prefix: string; section: PermissionSection } | null = null;
  for (const entry of PAGE_SECTIONS) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      if (!match || entry.prefix.length > match.prefix.length) match = entry;
    }
  }
  return match?.section ?? null;
}

export function sectionLabel(section: PermissionSection): string {
  return SECTIONS.find((entry) => entry.key === section)?.label ?? section;
}
