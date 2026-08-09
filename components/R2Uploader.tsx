'use client';

import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Copy, Loader2, Music, Image as ImageIcon } from 'lucide-react';

interface R2UploaderProps {
  label: string;
  accept?: string;
  folder?: string;
  target?: 'auto' | 'image' | 'audio' | 'video';
  value?: string;
  onChange: (url: string) => void;
  onUploadSuccess?: (file: File, url: string) => void | Promise<void>;
  helperText?: string;
}

export default function R2Uploader({
  label,
  accept = 'image/*,audio/*',
  folder = 'uploads',
  target = 'auto',
  value = '',
  onChange,
  onUploadSuccess,
  helperText,
}: R2UploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('target', target);

      const res = await fetch('/api/r2/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al subir el archivo');
      }

      const data = await res.json();
      onChange(data.url);
      if (onUploadSuccess) {
        await onUploadSuccess(file, data.url);
      }
    } catch (err: any) {
      setError(err.message || 'Error en la subida a R2');
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAudio = value && (value.endsWith('.mp3') || value.endsWith('.wav') || value.endsWith('.m4a') || value.includes('/audio/'));
  const isImage = value && (value.endsWith('.png') || value.endsWith('.jpg') || value.endsWith('.jpeg') || value.endsWith('.webp') || value.endsWith('.gif') || value.endsWith('.svg'));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
        {label}
      </label>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="URL del archivo o sube directamente a R2..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono transition"
          />
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copiar URL"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 transition"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          )}
        </div>

        <label className={`cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition ${
          uploading
            ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
        }`}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Subiendo a R2...</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-4 h-4 text-indigo-400" />
              <span>Subir a R2</span>
            </>
          )}
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {helperText && <p className="text-xs text-zinc-500">{helperText}</p>}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Media Preview */}
      {value && (
        <div className="mt-2 p-2 bg-zinc-900/50 border border-zinc-800/80 rounded-lg flex items-center gap-3">
          {isImage ? (
            <div className="relative w-12 h-12 rounded overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : isAudio ? (
            <div className="w-10 h-10 rounded bg-indigo-950/50 border border-indigo-900/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Music className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-zinc-300 truncate">{value}</p>
            {isAudio && (
              <audio controls src={value} className="mt-1 w-full h-7 text-xs" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
