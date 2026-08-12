'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  Folder,
  Loader2,
  Eye,
  Copy,
  Trash2,
  Edit3,
  Save,
  Image as ImageIcon,
  Music,
  Video,
  ChevronRight,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface BucketLike {
  id: string;
  label: string;
  bucketName: string;
}

interface FileItem {
  key: string;
  size: number;
  lastModified?: string | Date;
  url: string;
  bucketId?: string;
  bucketName?: string;
  bucketLabel?: string;
}

interface BucketFileBrowserProps {
  mode?: 'single' | 'unified';
  bucket?: BucketLike;
  buckets?: BucketLike[];
  onClose: () => void;
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function fileNameFromKey(key: string) {
  const trimmed = key.replace(/\/$/, '');
  return trimmed.split('/').pop() || trimmed;
}

export default function BucketFileBrowser({ mode = 'single', bucket, buckets, onClose }: BucketFileBrowserProps) {
  const isUnified = mode === 'unified';

  const [currentPrefix, setCurrentPrefix] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [unifiedTokens, setUnifiedTokens] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState<string | null>(null);

  const bucketNameForFile = useCallback(
    (file: FileItem) => file.bucketName || bucket?.bucketName || '',
    [bucket?.bucketName]
  );

  const load = useCallback(
    async (prefix: string, tokenState?: string | Record<string, string>, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        if (isUnified) {
          const tokens = (tokenState as Record<string, string>) || {};
          const params = new URLSearchParams({ prefix });
          if (Object.keys(tokens).length > 0) params.set('tokens', JSON.stringify(tokens));

          const res = await fetch(`/api/r2/browse-unified?${params.toString()}`);
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || 'Error al explorar el almacenamiento unificado');
          }

          const data = await res.json();
          setFolders((prev) => (append ? Array.from(new Set([...prev, ...data.folders])) : data.folders));
          setFiles((prev) => (append ? [...prev, ...data.files] : data.files));
          setUnifiedTokens(data.continuationTokens || {});
          setHasMore(Boolean(data.hasMore));
          if (data.failedBuckets?.length) {
            setError(`No se pudieron cargar algunos buckets: ${data.failedBuckets.join(', ')}`);
          }
        } else {
          if (!bucket) return;
          const token = tokenState as string | undefined;
          const params = new URLSearchParams({ bucket: bucket.bucketName, prefix });
          if (token) params.set('continuationToken', token);

          const res = await fetch(`/api/r2/browse?${params.toString()}`);
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || 'Error al explorar el bucket');
          }

          const data = await res.json();
          setFolders((prev) => (append ? Array.from(new Set([...prev, ...data.folders])) : data.folders));
          setFiles((prev) => (append ? [...prev, ...data.files] : data.files));
          setContinuationToken(data.nextContinuationToken);
        }
      } catch (err: any) {
        setError(err.message || 'Error al explorar el almacenamiento');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [isUnified, bucket]
  );

  useEffect(() => {
    load(currentPrefix);
  }, [currentPrefix, load]);

  const breadcrumbs = useMemo(() => {
    const segments = currentPrefix.split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      name: segment,
      path: segments.slice(0, index + 1).join('/') + '/',
    }));
  }, [currentPrefix]);

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return folders;
    return folders.filter((folder) => fileNameFromKey(folder).toLowerCase().includes(query));
  }, [folders, search]);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return files;
    return files.filter((file) => fileNameFromKey(file.key).toLowerCase().includes(query));
  }, [files, search]);

  const previewType = useMemo(() => {
    if (!previewFile) return { isImage: false, isAudio: false, isVideo: false, mimeType: undefined as string | undefined };
    const key = previewFile.key.toLowerCase();
    const isImage = !!key.match(/\.(png|jpe?g|webp|gif|svg|avif)$/i);
    const isAudio = !!key.match(/\.(mp3|wav|m4a|ogg|flac)$/i);
    const isVideo = !!key.match(/\.(mp4|webm|mov|mkv|avi)$/i);
    let mimeType: string | undefined;
    if (isAudio) {
      if (key.endsWith('.wav')) mimeType = 'audio/wav';
      else if (key.endsWith('.mp3')) mimeType = 'audio/mpeg';
      else if (key.endsWith('.m4a')) mimeType = 'audio/mp4';
      else if (key.endsWith('.ogg')) mimeType = 'audio/ogg';
      else if (key.endsWith('.flac')) mimeType = 'audio/flac';
    }
    if (isVideo) {
      if (key.endsWith('.mp4')) mimeType = 'video/mp4';
      else if (key.endsWith('.webm')) mimeType = 'video/webm';
      else if (key.endsWith('.mov')) mimeType = 'video/quicktime';
      else if (key.endsWith('.mkv')) mimeType = 'video/x-matroska';
      else if (key.endsWith('.avi')) mimeType = 'video/x-msvideo';
    }
    return { isImage, isAudio, isVideo, mimeType };
  }, [previewFile]);

  const iconForFile = (key: string) => {
    if (key.match(/\.(png|jpe?g|webp|gif|svg|avif)$/i)) return <ImageIcon className="h-5 w-5" />;
    if (key.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) return <Music className="h-5 w-5" />;
    if (key.match(/\.(mp4|webm|mov|mkv|avi)$/i)) return <Video className="h-5 w-5" />;
    return <Folder className="h-5 w-5" />;
  };

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(`¿Eliminar "${fileNameFromKey(file.key)}"?`)) return;

    setDeletingKey(file.key);
    setError(null);
    try {
      const res = await fetch('/api/r2/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key, bucket: bucketNameForFile(file) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al eliminar el archivo');
      }
      setFiles((prev) => prev.filter((item) => item.key !== file.key || item.bucketName !== file.bucketName));
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el archivo');
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteFolder = async (folderPrefix: string) => {
    if (!confirm(`¿Eliminar la carpeta "${fileNameFromKey(folderPrefix)}" y todo su contenido?`)) return;

    setDeletingFolder(folderPrefix);
    setError(null);
    try {
      if (isUnified) {
        const targets = buckets || [];
        const results = await Promise.allSettled(
          targets.map(async (b) => {
            const res = await fetch('/api/r2/files', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prefix: folderPrefix, bucket: b.bucketName }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              throw new Error(data?.error || `Error al eliminar la carpeta en ${b.label}`);
            }
          })
        );
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          setError(`No se pudo eliminar la carpeta en ${failed.length} de ${targets.length} bucket(s).`);
        }
      } else {
        if (!bucket) return;
        const res = await fetch('/api/r2/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix: folderPrefix, bucket: bucket.bucketName }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || 'Error al eliminar la carpeta');
        }
      }
      await load(currentPrefix);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la carpeta');
    } finally {
      setDeletingFolder(null);
    }
  };

  const startRename = (file: FileItem) => {
    setEditingKey(file.key);
    setRenameValue(fileNameFromKey(file.key));
  };

  const cancelRename = () => {
    setEditingKey(null);
    setRenameValue('');
  };

  const saveRename = async (file: FileItem) => {
    if (!renameValue.trim()) {
      setError('El nuevo nombre no puede estar vacío.');
      return;
    }

    const newKey = `${currentPrefix}${renameValue.trim()}`;
    if (newKey === file.key) {
      cancelRename();
      return;
    }

    setSavingRename(file.key);
    setError(null);
    try {
      const res = await fetch('/api/r2/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key, bucket: bucketNameForFile(file), newKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al renombrar el archivo');
      }
      cancelRename();
      await load(currentPrefix);
    } catch (err: any) {
      setError(err.message || 'Error al renombrar el archivo');
    } finally {
      setSavingRename(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4 shrink-0">
        <div className="min-w-0">
          {isUnified ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100 truncate">
                <Layers className="w-4 h-4 text-indigo-400" /> Almacenamiento unificado
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {buckets?.length || 0} bucket(s) conectados: {buckets?.map((b) => b.label).join(', ')}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-100 truncate">{bucket?.label}</p>
              <p className="text-xs text-zinc-500 truncate">{bucket?.bucketName}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(currentPrefix)}
            className="rounded-xl bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 transition"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 p-2 text-zinc-300 hover:bg-zinc-800 transition"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-zinc-800/80 px-5 py-3 shrink-0 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-300">
          <button onClick={() => setCurrentPrefix('')} className="text-zinc-400 hover:text-zinc-100 transition">
            Raíz
          </button>
          {breadcrumbs.map((segment) => (
            <span key={segment.path} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
              <button
                onClick={() => setCurrentPrefix(segment.path)}
                className="text-zinc-300 hover:text-white transition"
              >
                {segment.name}
              </button>
            </span>
          ))}
        </div>

        <label className="relative block w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar en esta carpeta"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-10 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-2">
            {filteredFolders.map((folder) => (
              <div
                key={folder}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900 px-4 py-3 hover:border-indigo-500 hover:bg-zinc-800 transition"
              >
                <button
                  onClick={() => setCurrentPrefix(folder)}
                  className="flex min-w-0 items-center gap-3 text-left text-zinc-100"
                >
                  <Folder className="h-5 w-5 shrink-0 text-amber-400" />
                  <span className="truncate font-medium">{fileNameFromKey(folder)}</span>
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder)}
                  disabled={deletingFolder === folder}
                  className="shrink-0 rounded-xl bg-red-700/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-700/20 transition"
                >
                  {deletingFolder === folder ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            ))}

            {filteredFiles.map((file) => (
              <div
                key={`${file.bucketId || ''}:${file.key}`}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-zinc-500">
                      {iconForFile(file.key)}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-100" title={file.key}>
                        {fileNameFromKey(file.key)}
                        {isUnified && file.bucketLabel && (
                          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-normal text-zinc-400">
                            {file.bucketLabel}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatSize(file.size)}
                        {file.lastModified ? ` · ${new Date(file.lastModified).toLocaleDateString('es-ES')}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="rounded-xl bg-zinc-950 p-2 text-zinc-300 hover:bg-zinc-800 transition"
                      title="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopy(file.url, file.key)}
                      className="rounded-xl bg-zinc-950 p-2 text-zinc-300 hover:bg-zinc-800 transition"
                      title="Copiar URL"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedKey === file.key && <span className="sr-only">Copiado</span>}
                    </button>
                    <button
                      onClick={() => startRename(file)}
                      className="rounded-xl bg-zinc-950 p-2 text-zinc-300 hover:bg-zinc-800 transition"
                      title="Renombrar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      disabled={deletingKey === file.key}
                      className="rounded-xl bg-red-700/10 p-2 text-red-300 hover:bg-red-700/20 transition"
                      title="Eliminar"
                    >
                      {deletingKey === file.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {editingKey === file.key && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-2">
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      onClick={() => saveRename(file)}
                      disabled={savingRename === file.key}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                    >
                      {savingRename === file.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={cancelRename}
                      className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!loading && filteredFolders.length === 0 && filteredFiles.length === 0 && (
              <div className="rounded-3xl border border-dashed border-zinc-800/70 bg-zinc-900/40 p-10 text-center text-zinc-500">
                Esta carpeta está vacía.
              </div>
            )}

            {(isUnified ? hasMore : Boolean(continuationToken)) && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => load(currentPrefix, isUnified ? unifiedTokens : continuationToken, true)}
                  disabled={loadingMore}
                  className="rounded-2xl bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  {loadingMore ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100">Vista previa</p>
                <p className="truncate text-xs text-zinc-500">{previewFile.key}</p>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-4">
              {previewType.isImage ? (
                <img src={previewFile.url} alt={previewFile.key} className="w-full rounded-3xl object-contain" />
              ) : previewType.isAudio ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <audio controls className="w-full rounded-2xl bg-black" preload="metadata">
                    <source src={previewFile.url} type={previewType.mimeType || 'audio/mpeg'} />
                    Tu navegador no soporta audio HTML5.
                  </audio>
                </div>
              ) : previewType.isVideo ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <video controls className="w-full rounded-3xl bg-black" preload="metadata">
                    <source src={previewFile.url} type={previewType.mimeType || 'video/mp4'} />
                    Tu navegador no soporta video HTML5.
                  </video>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-400">
                  <p className="text-sm font-medium text-zinc-100">Vista previa no disponible para este tipo de archivo.</p>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    Abrir en nueva pestaña
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
