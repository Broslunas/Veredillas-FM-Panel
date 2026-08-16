'use client';

import React, { useState, useRef } from 'react';
import {
  Video,
  UploadCloud,
  Film,
  Info,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  RefreshCw,
  Zap,
  X,
  HardDrive,
  Sparkles,
  Layers,
  Share2,
  Lock,
  FileVideo
} from 'lucide-react';

interface QueueItem {
  file: File;
  title: string;
  url: string;
}

interface LogEntry {
  id: string;
  msg: string;
  type: 'info' | 'success' | 'error';
  timestamp: string;
}

export default function SocialHighlightsStudioPage() {
  const [step, setStep] = useState<'selection' | 'wizard' | 'success'>('selection');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [clipTitle, setClipTitle] = useState('');
  
  // Upload Progress
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [overlayStatus, setOverlayStatus] = useState('PREPARANDO...');

  // Logs & Info Modal
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).slice(2),
      msg,
      type,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setLogs((prev) => [entry, ...prev]);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Handle File Selection
  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const validVideos = Array.from(files)
      .filter((f) => f.type.startsWith('video/'))
      .map((f) => ({
        file: f,
        title: f.name.replace(/\.[^/.]+$/, ''),
        url: URL.createObjectURL(f),
      }));

    if (validVideos.length === 0) {
      alert('Por favor selecciona archivos de vídeo válidos (MP4, MOV, WEBM).');
      return;
    }

    setQueue(validVideos);
    setCurrentIndex(0);
    setClipTitle(validVideos[0].title);
    setStep('wizard');
    addLog(`Cargados ${validVideos.length} clips en el asistente.`);
  };

  const currentItem = queue[currentIndex];

  const handleNextClip = async () => {
    if (!currentItem || !clipTitle.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);
    setBytesUploaded(0);
    setTotalBytes(currentItem.file.size);
    setOverlayStatus('SOLICITANDO URL R2...');

    addLog(`Iniciando carga de "${clipTitle}" (${formatBytes(currentItem.file.size)})`);

    try {
      // 1. Get presigned R2 URL from our Next.js API
      const presignRes = await fetch('/api/admin/r2-presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: currentItem.file.name,
          contentType: currentItem.file.type,
          folder: 'social-clips',
          target: 'social',
        }),
      });

      if (!presignRes.ok) throw new Error('Error al obtener URL presignada de R2');
      const { presignedUrl, publicUrl, key } = await presignRes.json();

      addLog('URL presignada obtenida. Subiendo directamente a Cloudflare R2...', 'info');
      setOverlayStatus('SUBIENDO A R2...');

      // 2. Upload file directly to R2 using XMLHttpRequest with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', currentItem.file.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
            setBytesUploaded(e.loaded);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Error R2 ${xhr.status}`));
        };

        xhr.onerror = () => reject(new Error('Conexión interrumpida durante la subida.'));
        xhr.send(currentItem.file);
      });

      addLog('Carga exitosa en R2. Sincronizando con flujo n8n...', 'success');
      setOverlayStatus('NOTIFICANDO FLUJO SOCIAL...');

      // 3. Trigger server-side webhook proxy for n8n
      const webhookRes = await fetch('/api/admin/social-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: publicUrl,
          key,
          title: clipTitle.trim(),
          fileName: currentItem.file.name,
          fileSize: currentItem.file.size,
          contentType: currentItem.file.type,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!webhookRes.ok) throw new Error('Falló la notificación al webhook de n8n.');

      addLog(`Clip "${clipTitle}" procesado y notificado correctamente.`, 'success');

      // Move to next clip or complete
      const nextIdx = currentIndex + 1;
      if (nextIdx < queue.length) {
        setTimeout(() => {
          setIsUploading(false);
          setCurrentIndex(nextIdx);
          setClipTitle(queue[nextIdx].title);
        }, 800);
      } else {
        setTimeout(() => {
          setIsUploading(false);
          setStep('success');
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      addLog(`ERROR: ${err.message || 'Error en el proceso'}`, 'error');
      setOverlayStatus('ERROR EN PROCESO');
      setTimeout(() => {
        setIsUploading(false);
      }, 2500);
    }
  };

  const handleReset = () => {
    setQueue([]);
    setCurrentIndex(0);
    setClipTitle('');
    setLogs([]);
    setStep('selection');
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto w-full">
      {/* ── HEADER WITH BETTER NAME & INFO BUTTON ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
              <span>Estudio de Highlights & Clips</span>
              <Video className="w-6 h-6 text-indigo-400" />
            </h1>

            {/* INFO BUTTON */}
            <button
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 hover:text-white hover:bg-indigo-900 transition shadow-sm flex items-center gap-1.5 text-xs font-mono"
              title="Información y ayuda sobre esta herramienta"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Info & Guía</span>
            </button>
          </div>

          <p className="text-xs text-zinc-400 mt-1">
            Asistente inteligente para carga secuencial de cortes de vídeo a R2 y distribución social automatizada.
          </p>
        </div>

        {/* R2 Connected Status Indicator */}
        <div className="flex items-center gap-2.5 bg-zinc-900/90 border border-emerald-900/60 px-3.5 py-1.5 rounded-xl text-xs font-mono text-emerald-400 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <HardDrive className="w-3.5 h-3.5" />
          <span>Cloudflare R2 Conectado</span>
        </div>
      </div>

      {/* ── STEP 1: INITIAL MULTI-SELECTION DROPZONE ── */}
      {step === 'selection' && (
        <div className="animate-in fade-in duration-300">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            className="group border-2 border-dashed border-zinc-800 hover:border-indigo-500/60 bg-zinc-900/40 hover:bg-indigo-950/20 rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden"
          >
            <div className="w-20 h-20 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition duration-300 mb-6 shadow-xl shadow-indigo-950/50">
              <UploadCloud className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-zinc-100 mb-2">Selecciona o arrastra tus vídeos</h2>
            <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
              Puedes seleccionar múltiples archivos a la vez. El asistente los procesará de forma secuencial.
            </p>

            <span className="text-[10px] font-mono uppercase tracking-widest px-3.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-500 font-semibold">
              Formatos soportados: MP4, MOV, WEBM
            </span>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </div>
        </div>
      )}

      {/* ── STEP 2: SEQUENTIAL WIZARD ── */}
      {step === 'wizard' && currentItem && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          {/* Left: Video Preview Player */}
          <div className="lg:col-span-8 space-y-4">
            {/* Banner Top */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 px-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider block">
                  Procesando Clip
                </span>
                <p className="text-sm font-bold text-zinc-100 truncate max-w-[280px] sm:max-w-md">
                  {currentItem.file.name}
                </p>
              </div>

              <span className="text-xs font-mono font-bold bg-indigo-600 text-white px-3 py-1 rounded-lg">
                {currentIndex + 1} / {queue.length}
              </span>
            </div>

            {/* Video Player Box */}
            <div className="relative bg-black border border-zinc-800 rounded-2xl overflow-hidden aspect-video shadow-2xl flex items-center justify-center group">
              <video
                ref={videoRef}
                src={currentItem.url}
                controls
                className="w-full h-full object-contain"
              />

              {/* Uploading Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                  <h4 className="text-xl font-extrabold text-zinc-100 tracking-tight">{overlayStatus}</h4>

                  {/* Progress Bar */}
                  <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 h-3.5 rounded-full overflow-hidden relative">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between w-full max-w-md text-xs font-mono text-zinc-400">
                    <span>
                      {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
                    </span>
                    <span className="font-bold text-indigo-400">{uploadProgress}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Clip Details & Controls */}
          <div className="lg:col-span-4 space-y-6 flex flex-col">
            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-6 shadow-xl">
              <div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider block mb-2">
                  Detalles del Clip
                </span>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">Título del Vídeo / Clip</label>
                <input
                  type="text"
                  value={clipTitle}
                  onChange={(e) => setClipTitle(e.target.value)}
                  disabled={isUploading}
                  placeholder="Escribe un título optimizado para redes..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleNextClip}
                  disabled={isUploading || !clipTitle.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-lg shadow-indigo-600/20"
                >
                  <span>{isUploading ? 'Subiendo...' : 'SUBIR Y SIGUIENTE'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleReset}
                  disabled={isUploading}
                  className="w-full text-zinc-500 hover:text-rose-400 text-[11px] font-mono transition py-1 text-center block"
                >
                  Cancelar proceso
                </button>
              </div>
            </div>

            {/* Real-time Activity Terminal */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex-1 flex flex-col space-y-2 min-h-[160px]">
              <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold tracking-wider border-b border-zinc-900 pb-1.5 block">
                Actividad en tiempo real
              </span>
              <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] max-h-[180px]">
                {logs.length === 0 ? (
                  <span className="text-zinc-600 italic">Esperando inicio...</span>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-1.5 ${
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'error'
                          ? 'text-rose-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                      <span>{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: SUCCESS SCREEN ── */}
      {step === 'success' && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-12 text-center space-y-6 max-w-lg mx-auto animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-950">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold text-zinc-100">¡Carga Completada!</h2>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Todos los clips se han cargado exitosamente a Cloudflare R2 y la automatización en n8n ha sido notificada.
            </p>
          </div>

          <button
            onClick={handleReset}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-indigo-600/20"
          >
            Nueva Carga de Clips
          </button>
        </div>
      )}

      {/* ── INFO & GUIDE MODAL ── */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 space-y-5 relative shadow-2xl">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 p-1 rounded-lg bg-zinc-800/50 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="border-b border-zinc-800 pb-3 flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">
                  ¿Qué es el Estudio de Highlights & Clips?
                </h3>
                <p className="text-xs text-zinc-500">Guía de uso y funcionamiento técnico de la plataforma.</p>
              </div>
            </div>

            {/* Content Sections */}
            <div className="space-y-4 text-xs text-zinc-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              {/* Section 1 */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <FileVideo className="w-4 h-4 text-indigo-400" />
                  <span>1. Asistente de Carga Secuencial</span>
                </div>
                <p className="text-zinc-400">
                  Herramienta diseñada para procesar múltiples cortes de vídeo (Reels, Shorts, TikToks) extraídos de episodios o entrevistas de Veredillas FM. Permite subir archivo por archivo asignando títulos y etiquetas personalizadas sin saturar el navegador.
                </p>
              </div>

              {/* Section 2 */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>2. Subida Directa a Cloudflare R2 (S3)</span>
                </div>
                <p className="text-zinc-400">
                  Los vídeos no pasan por los servidores intermedios de Node.js. Mediante URLs presignadas de alta velocidad, se envían directamente al bucket de Cloudflare R2 `vfm-social`, guardándose como `social-clips/[archivo].[extensión]`, lo que garantiza velocidad máxima y soporte para archivos pesados de alta resolución.
                </p>
              </div>

              {/* Section 3 */}
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-zinc-100">
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>3. Automatización de Publicación con n8n</span>
                </div>
                <p className="text-zinc-400">
                  Una vez que cada archivo se sube correctamente a R2, la plataforma envía un webhook a n8n (`/webhook/clips-upload-vfm`) con los metadatos y la URL pública. Esto permite que tus flujos de automatización programen las publicaciones en redes sociales o transcodifiquen el clip automáticamente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-zinc-800 pt-3">
              <button
                onClick={() => setShowInfoModal(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-1.5 rounded-lg text-xs font-medium transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
