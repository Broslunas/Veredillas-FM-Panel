'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UploadCloud, Trash2, Loader2, CheckCircle2, AlertCircle, RefreshCw, Video } from 'lucide-react';

type Visibility = 'public' | 'unlisted' | 'private';

interface ClipUploadItem {
  id: string;
  file: File;
  title: string;
  visibility: Visibility;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  url?: string;
}

interface ClipYouTubeBatchUploaderProps {
  onUploaded: (clip: { title: string; url: string }) => void;
}

export default function ClipYouTubeBatchUploader({ onUploaded }: ClipYouTubeBatchUploaderProps) {
  const [items, setItems] = useState<ClipUploadItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<ClipUploadItem[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newItems: ClipUploadItem[] = Array.from(files)
      .filter((f) => f.type.startsWith('video/'))
      .map((f) => ({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`,
        file: f,
        title: f.name.replace(/\.[^/.]+$/, ''),
        visibility: 'unlisted',
        status: 'pending',
        progress: 0,
      }));

    if (newItems.length === 0) {
      alert('Por favor selecciona archivos de vídeo válidos.');
    }

    setItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateItem = (id: string, patch: Partial<ClipUploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const uploadItem = async (item: ClipUploadItem) => {
    updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });

    try {
      const finalTitle = item.title.trim() || item.file.name.replace(/\.[^/.]+$/, '');

      const sessionRes = await fetch('/api/youtube/upload/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: '',
          tags: [],
          categoryId: '22',
          privacyStatus: item.visibility,
          mimeType: item.file.type || 'video/mp4',
          fileSize: item.file.size,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.uploadUrl) {
        throw new Error(sessionData.error || 'No se pudo iniciar la sesión de subida en YouTube.');
      }

      const videoId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', sessionData.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', item.file.type || 'video/mp4');

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            updateItem(item.id, { progress: Math.round((evt.loaded / evt.total) * 100) });
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              const resp = JSON.parse(xhr.responseText);
              if (resp.id) resolve(resp.id);
              else reject(new Error('Subida completada pero no se recibió el ID del vídeo.'));
            } catch {
              reject(new Error('Respuesta inválida de YouTube.'));
            }
          } else {
            reject(new Error(`Error al subir el vídeo a YouTube (HTTP ${xhr.status}).`));
          }
        };

        xhr.onerror = () => reject(new Error('Error de conexión durante la subida a YouTube.'));
        xhr.send(item.file);
      });

      const url = `https://youtu.be/${videoId}`;
      updateItem(item.id, { status: 'success', progress: 100, url });
      onUploaded({ title: finalTitle, url });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir el vídeo.';
      updateItem(item.id, { status: 'error', error: message });
    }
  };

  const uploadAll = async () => {
    setIsProcessing(true);
    const idsToProcess = items
      .filter((it) => it.status === 'pending' || it.status === 'error')
      .map((it) => it.id);

    for (const id of idsToProcess) {
      const current = itemsRef.current.find((it) => it.id === id);
      if (!current) continue;
      await uploadItem(current);
    }

    setIsProcessing(false);
  };

  const hasUploadable = items.some((it) => it.status === 'pending' || it.status === 'error');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Video className="w-4 h-4 text-red-500" />
            <span>Subir Clips desde tu Ordenador a YouTube</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Selecciona varios vídeos a la vez, edita el título y la visibilidad de cada uno, y súbelos a YouTube de uno en uno.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4 text-indigo-400" />
            <span>Seleccionar Vídeos</span>
          </button>

          {hasUploadable && (
            <button
              type="button"
              onClick={uploadAll}
              disabled={isProcessing}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              <span>{isProcessing ? 'Subiendo...' : 'Subir a YouTube (uno a uno)'}</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  disabled={item.status === 'uploading' || item.status === 'success'}
                  placeholder="Título del clip"
                  className="flex-1 min-w-[160px] bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-100 disabled:opacity-60 focus:outline-none focus:border-zinc-600"
                />

                <select
                  value={item.visibility}
                  onChange={(e) => updateItem(item.id, { visibility: e.target.value as Visibility })}
                  disabled={item.status === 'uploading' || item.status === 'success'}
                  className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-60 focus:outline-none focus:border-zinc-600"
                >
                  <option value="public">Público</option>
                  <option value="unlisted">Oculto</option>
                  <option value="private">Privado</option>
                </select>

                {item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition"
                    title="Quitar de la lista"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => uploadItem(item)}
                    disabled={isProcessing}
                    className="p-1 text-amber-400 hover:text-amber-300 transition disabled:opacity-50"
                    title="Reintentar subida"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}

                {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
                {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
                <span className="truncate max-w-[240px]">{item.file.name}</span>
                <span>({(item.file.size / (1024 * 1024)).toFixed(1)} MB)</span>
              </div>

              {item.status === 'uploading' && (
                <div className="w-full bg-zinc-900 border border-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.status === 'success' && item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-mono text-emerald-400 hover:underline block truncate"
                >
                  {item.url}
                </a>
              )}

              {item.status === 'error' && item.error && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
