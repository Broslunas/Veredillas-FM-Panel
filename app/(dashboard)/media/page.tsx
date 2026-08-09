'use client';

import React, { useEffect, useState } from 'react';
import { UploadCloud, HardDrive, Trash2, Copy, CheckCircle2, Loader2, Music, Image as ImageIcon, File } from 'lucide-react';

export default function R2MediaHubPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/r2/files');
      if (res.status === 403) {
        setIsForbidden(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files || []);
      }
    } catch (err) {
      console.error('Error loading R2 files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setErrorMessage(null);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'uploads');

        const res = await fetch('/api/r2/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Error al subir ${file.name}`);
        }
      }

      await loadFiles();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error en la subida a R2');
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = async (key: string) => {
    if (!confirm(`¿Eliminar de R2 el archivo "${key}"?`)) return;

    setDeletingKey(key);
    try {
      const res = await fetch('/api/r2/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.key !== key));
      }
    } catch (err) {
      alert('Error al eliminar archivo de R2');
    } finally {
      setDeletingKey(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isForbidden) {
    return (
      <div className="p-8 max-w-4xl mx-auto w-full min-h-[60vh] flex items-center justify-center">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center space-y-3 max-w-md w-full">
          <HardDrive className="w-10 h-10 text-amber-500/60 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-100">Acceso Restringido</h2>
          <p className="text-xs text-zinc-400 font-mono">
            Los editores no tienen permisos para ver ni gestionar la biblioteca de Medios R2.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <span>Biblioteca de Medios Cloudflare R2</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Gestión y subida directa de archivos de audio e imágenes almacenados en R2
          </p>
        </div>

        <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition shadow-lg shadow-indigo-600/20 ${
          uploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Subiendo a R2...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Subir Archivos</span>
            </>
          )}
          <input
            type="file"
            multiple
            accept="image/*,audio/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-300 font-mono">
          {errorMessage}
        </div>
      )}

      {/* Files Grid */}
      {loading ? (
        <div className="p-12 flex justify-center text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span className="text-xs font-mono">Cargando archivos de R2...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="p-12 border border-zinc-800/80 rounded-xl text-center space-y-3">
          <p className="text-xs font-mono text-zinc-500">No hay archivos en la biblioteca R2.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => {
            const isImage = file.key.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);
            const isAudio = file.key.match(/\.(mp3|wav|m4a|ogg)$/i);

            return (
              <div
                key={file.key}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 space-y-3 hover:border-zinc-700/80 transition flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isImage ? (
                    <div className="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt={file.key} className="w-full h-full object-cover" />
                    </div>
                  ) : isAudio ? (
                    <div className="w-12 h-12 rounded-lg bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center text-indigo-400 shrink-0">
                      <Music className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                      <File className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono font-medium text-zinc-200 truncate" title={file.key}>
                      {file.key.split('/').pop()}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      {formatSize(file.size)} &bull; {file.lastModified ? new Date(file.lastModified).toLocaleDateString('es-ES') : ''}
                    </p>
                  </div>
                </div>

                {isAudio && (
                  <audio controls src={file.url} className="w-full h-7 text-xs" />
                )}

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <button
                    onClick={() => handleCopy(file.url, file.key)}
                    className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition"
                  >
                    {copiedKey === file.key ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar URL</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(file.key)}
                    disabled={deletingKey === file.key}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                    title="Eliminar de R2"
                  >
                    {deletingKey === file.key ? (
                      <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
