'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HardDrive,
  Search,
  Trash2,
  Copy,
  CheckCircle2,
  Loader2,
  Music,
  Image as ImageIcon,
  Eye,
  Folder,
  Video,
  Edit3,
  Save,
  X,
} from 'lucide-react';

interface R2FileItem {
  key: string;
  size: number;
  lastModified?: string | Date;
  url: string;
  bucket: string;
  isImage: boolean;
}

interface BucketUsage {
  bucket: string;
  totalBytes: number;
  totalObjects: number;
  maxBytes: number | null;
}

export default function BucketsAdminPage() {
  const [files, setFiles] = useState<R2FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucketUsage, setBucketUsage] = useState<BucketUsage[]>([]);
  const [totalBytesAcrossBuckets, setTotalBytesAcrossBuckets] = useState(0);
  const [quotaInputs, setQuotaInputs] = useState<Record<string, string>>({});
  const [savingQuotaBucket, setSavingQuotaBucket] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [currentPath, setCurrentPath] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<R2FileItem | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/r2/files');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al cargar archivos de R2');
      }

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con la API de R2');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshFlag]);

  const loadBucketUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/r2-buckets');
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setBucketUsage(data.usage || []);
      setTotalBytesAcrossBuckets(data.totalBytesAcrossBuckets || 0);
      setQuotaInputs(
        (data.usage || []).reduce((acc: Record<string, string>, item: BucketUsage) => {
          acc[item.bucket] = item.maxBytes !== null ? String(Math.round(item.maxBytes / 1024 / 1024)) : '';
          return acc;
        }, {})
      );
    } catch (err) {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadBucketUsage();
  }, [loadBucketUsage, refreshFlag]);

  useEffect(() => {
    if (!selectedBucket && bucketUsage.length > 0) {
      setSelectedBucket(bucketUsage[0].bucket);
      setCurrentPath('');
    }
  }, [bucketUsage, selectedBucket]);

  const bucketOptions = useMemo(() => {
    return Array.from(new Set([...files.map((file) => file.bucket), ...bucketUsage.map((item) => item.bucket)]));
  }, [files, bucketUsage]);

  const currentBucketFiles = useMemo(() => {
    return files.filter((file) => file.bucket === selectedBucket);
  }, [files, selectedBucket]);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fileNameFromKey = (key: string) => key.split('/').pop() || key;

  const normalizePrefix = (value: string) => {
    const cleaned = value.replace(/^\/+|\/+$/g, '');
    return cleaned ? `${cleaned}/` : '';
  };

  const folderContents = useMemo(() => {
    const prefix = normalizePrefix(currentPath);
    const folders = new Map<string, { name: string; path: string }>();
    const filesAtPath: R2FileItem[] = [];

    currentBucketFiles.forEach((file) => {
      if (!file.key.startsWith(prefix)) return;

      const remainder = file.key.slice(prefix.length);
      if (!remainder) return;

      const nextSlash = remainder.indexOf('/');
      if (nextSlash === -1) {
        filesAtPath.push(file);
      } else {
        const folderName = remainder.slice(0, nextSlash);
        const folderPath = `${prefix}${folderName}/`;
        if (!folders.has(folderPath)) {
          folders.set(folderPath, { name: folderName, path: folderPath });
        }
      }
    });

    const folderList = Array.from(folders.values()).sort((a, b) => a.name.localeCompare(b.name));
    const fileList = filesAtPath.sort((a, b) => a.key.localeCompare(b.key));

    return { folderList, fileList };
  }, [currentBucketFiles, currentPath]);

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return folderContents.folderList;
    return folderContents.folderList.filter((folder) => folder.name.toLowerCase().includes(query));
  }, [folderContents.folderList, search]);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return folderContents.fileList;
    return folderContents.fileList.filter(
      (file) => fileNameFromKey(file.key).toLowerCase().includes(query) || file.key.toLowerCase().includes(query)
    );
  }, [folderContents.fileList, search]);

  const pathSegments = useMemo(() => {
    const prefix = normalizePrefix(currentPath);
    const segments = prefix.split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      name: segment,
      path: segments.slice(0, index + 1).join('/') + '/',
    }));
  }, [currentPath]);

  const previewType = useMemo(() => {
    if (!previewFile) return { isAudio: false, isVideo: false, mimeType: undefined };
    const key = previewFile.key.toLowerCase();
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

    return { isAudio, isVideo, mimeType };
  }, [previewFile]);

  const handleDelete = async (key: string, bucket?: string) => {
    if (!confirm(`¿Eliminar de R2 el archivo "${key}"?`)) return;

    setDeletingKey(key);
    try {
      const res = await fetch('/api/r2/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, bucket }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al eliminar archivo de R2');
      }

      setFiles((prev) => prev.filter((file) => file.key !== key));
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar archivo de R2');
    } finally {
      setDeletingKey(null);
    }
  };

  const startRename = (file: R2FileItem) => {
    const basename = file.key.includes('/') ? file.key.slice(file.key.lastIndexOf('/') + 1) : file.key;
    setEditingKey(file.key);
    setRenameValue(basename);
  };

  const cancelRename = () => {
    setEditingKey(null);
    setRenameValue('');
  };

  const saveRename = async (file: R2FileItem) => {
    if (!editingKey) return;
    if (!renameValue.trim()) {
      setErrorMessage('El nuevo nombre no puede estar vacío.');
      return;
    }

    const folder = file.key.includes('/') ? file.key.slice(0, file.key.lastIndexOf('/') + 1) : '';
    const newKey = `${folder}${renameValue.trim()}`;
    if (newKey === file.key) {
      cancelRename();
      return;
    }

    setSavingRename(file.key);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/r2/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: file.key, bucket: file.bucket, newKey }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al renombrar archivo');
      }

      setRefreshFlag((prev) => prev + 1);
      cancelRename();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al renombrar archivo de R2');
    } finally {
      setSavingRename(null);
    }
  };

  const handlePreview = (file: R2FileItem) => {
    setPreviewFile(file);
  };

  const closePreview = () => {
    setPreviewFile(null);
  };

  const handleBucketQuotaChange = (bucket: string, value: string) => {
    setQuotaInputs((prev) => ({ ...prev, [bucket]: value }));
  };

  const saveBucketQuota = async (bucket: string) => {
    const value = quotaInputs[bucket];
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      setErrorMessage('El límite debe ser un número de MB válido.');
      return;
    }
    setSavingQuotaBucket(bucket);
    try {
      const res = await fetch('/api/admin/r2-buckets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, maxBytes: parsed * 1024 * 1024 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al guardar el límite del bucket');
      }
      await loadBucketUsage();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar límite de bucket');
    } finally {
      setSavingQuotaBucket(null);
    }
  };

  const handleDeleteFolder = async (prefix: string) => {
    if (!confirm(`¿Eliminar la carpeta "${prefix}" y todo su contenido?`)) return;

    setDeletingFolder(prefix);
    try {
      const res = await fetch('/api/r2/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, bucket: selectedBucket }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Error al eliminar carpeta de R2');
      }

      setRefreshFlag((prev) => prev + 1);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar carpeta de R2');
    } finally {
      setDeletingFolder(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-zinc-100">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-semibold">Administración de Buckets R2</h1>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Explora los buckets uno a uno con navegación de carpetas y acciones de gestión rápida.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar carpeta o archivo"
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs text-zinc-300">
        <span className="font-semibold text-zinc-400">Bucket:</span>
        {bucketOptions.map((bucket) => (
          <button
            key={bucket}
            onClick={() => {
              setSelectedBucket(bucket);
              setCurrentPath('');
              setSearch('');
            }}
            className={`rounded-full px-3 py-1 transition ${selectedBucket === bucket ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}
          >
            {bucket}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Uso total de buckets</h2>
          <p className="text-xs text-zinc-500">{formatSize(totalBytesAcrossBuckets)} en {bucketUsage.length} bucket(s)</p>
        </div>

        <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Límites de buckets</h2>
          <div className="mt-3 space-y-3">
            {bucketUsage.map((item) => (
              <div key={item.bucket} className="rounded-3xl border border-zinc-800/70 bg-zinc-900 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-400">{item.bucket}</p>
                    <p className="text-sm font-medium text-zinc-100">
                      {formatSize(item.totalBytes)} / {item.maxBytes !== null ? formatSize(item.maxBytes) : 'Sin límite'}
                    </p>
                  </div>
                  <div className="text-xs text-zinc-400">
                    {item.maxBytes !== null ? `${Math.min(100, Math.round((item.totalBytes / item.maxBytes) * 100))}%` : 'N/A'}
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    min={0}
                    value={quotaInputs[item.bucket] ?? ''}
                    onChange={(event) => handleBucketQuotaChange(item.bucket, event.target.value)}
                    placeholder="MB"
                    className="w-full sm:w-32 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveBucketQuota(item.bucket)}
                    disabled={savingQuotaBucket === item.bucket}
                    className="inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition disabled:cursor-not-allowed disabled:bg-zinc-700"
                  >
                    {savingQuotaBucket === item.bucket ? 'Guardando...' : 'Guardar límite'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">
            <button
              onClick={() => setCurrentPath('')}
              className="text-zinc-400 hover:text-zinc-100 transition"
            >
              Raíz
            </button>
            {pathSegments.map((segment) => (
              <span key={segment.path} className="flex items-center gap-2">
                <span className="text-zinc-600">/</span>
                <button
                  onClick={() => setCurrentPath(segment.path)}
                  className="text-zinc-300 hover:text-white transition"
                >
                  {segment.name}
                </button>
              </span>
            ))}
          </div>
          <div className="text-xs text-zinc-500">
            {currentBucketFiles.length} archivos en este bucket
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Carpetas</p>
            {filteredFolders.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No hay carpetas en esta ruta.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {filteredFolders.map((folder) => (
                  <div key={folder.path} className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900 px-4 py-3 hover:border-indigo-500 hover:bg-zinc-800 transition">
                    <button
                      onClick={() => setCurrentPath(folder.path)}
                      className="flex items-center gap-3 min-w-0 text-left text-zinc-100"
                    >
                      <Folder className="h-5 w-5 text-amber-400" />
                      <span className="font-medium truncate">{folder.name}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(folder.path)}
                      disabled={deletingFolder === folder.path}
                      className="rounded-xl bg-red-700/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-700/20 transition"
                    >
                      {deletingFolder === folder.path ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Archivos</p>
                <p className="text-sm text-zinc-400">{filteredFiles.length} resultado(s)</p>
              </div>
            </div>

            {filteredFiles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800/70 bg-zinc-900/60 p-10 text-center text-zinc-500">
                No hay archivos en esta carpeta.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredFiles.map((file) => {
                  const isImageFile = file.key.match(/\.(png|jpe?g|webp|gif|svg)$/i);
                  const isAudioFile = file.key.match(/\.(mp3|wav|m4a|ogg|flac)$/i);
                  const isVideoFile = file.key.match(/\.(mp4|webm|mov|mkv|avi)$/i);

                  return (
                    <div key={file.key} className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-4 shadow-sm shadow-black/10">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
                            {isImageFile ? (
                              <ImageIcon className="h-6 w-6" />
                            ) : isAudioFile ? (
                              <Music className="h-6 w-6" />
                            ) : isVideoFile ? (
                              <Video className="h-6 w-6" />
                            ) : (
                              <FileIconInner />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-100" title={file.key}>{fileNameFromKey(file.key)}</p>
                            <p className="text-xs text-zinc-500">{file.bucket}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span>{formatSize(file.size)}</span>
                          <span>·</span>
                          <span>{file.lastModified ? new Date(file.lastModified).toLocaleDateString('es-ES') : '—'}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <button
                          onClick={() => handlePreview(file)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </button>
                        <button
                          onClick={() => handleCopy(file.url, file.key)}
                          className="rounded-2xl bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
                        >
                          {copiedKey === file.key ? 'Copiado' : 'Copiar URL'}
                        </button>
                        <button
                          onClick={() => startRename(file)}
                          className="rounded-2xl bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
                        >
                          Renombrar
                        </button>
                        <button
                          onClick={() => handleDelete(file.key, file.bucket)}
                          disabled={deletingKey === file.key}
                          className="rounded-2xl bg-red-700/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-700/20 transition"
                        >
                          {deletingKey === file.key ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>

                      {editingKey === file.key ? (
                        <div className="mt-4 rounded-3xl border border-indigo-500/30 bg-indigo-950/20 p-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              onClick={cancelRename}
                              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => saveRename(file)}
                            disabled={savingRename === file.key}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                          >
                            {savingRename === file.key ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                            ) : (
                              <><Save className="w-4 h-4" /> Guardar</>
                            )}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewFile ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">Vista previa</p>
                <p className="text-xs text-zinc-500">{previewFile.key}</p>
              </div>
              <button
                onClick={closePreview}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto p-4">
              {previewFile.isImage ? (
                <img src={previewFile.url} alt={previewFile.key} className="w-full rounded-3xl object-contain" />
              ) : previewType.isAudio ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-sm font-medium text-zinc-100 mb-3">Reproductor de audio</p>
                  <audio controls className="w-full rounded-2xl bg-black" preload="metadata">
                    <source src={previewFile.url} type={previewType.mimeType || 'audio/mpeg'} />
                    Tu navegador no soporta audio HTML5.
                  </audio>
                </div>
              ) : previewType.isVideo ? (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
                  <p className="text-sm font-medium text-zinc-100 mb-3">Reproductor de video</p>
                  <video controls className="w-full rounded-3xl bg-black" preload="metadata">
                    <source src={previewFile.url} type={previewType.mimeType || 'video/mp4'} />
                    Tu navegador no soporta video HTML5.
                  </video>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900 p-6 text-center text-zinc-400">
                  <p className="text-sm font-medium text-zinc-100">Vista previa no disponible para este tipo de archivo.</p>
                  <a href={previewFile.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition">
                    Abrir en nueva pestaña
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FileIcon() {
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
      <FileIconInner />
    </div>
  );
}

function FileIconInner() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 3.5L19.5 9H14V3.5z" />
    </svg>
  );
}

