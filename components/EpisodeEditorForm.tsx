'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import R2Uploader from '@/components/R2Uploader';
import ClipYouTubeBatchUploader from '@/components/ClipYouTubeBatchUploader';
import { uploadFileToR2ViaPresignedUrl } from '@/lib/r2-client';
import { Mp3Encoder } from '@breezystack/lamejs';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  List,
  MessageSquare,
  Video,
  HelpCircle,
  Radio,
  Loader2,
  CheckCircle2,
  Sparkles,
  Music,
} from 'lucide-react';

interface EpisodeEditorProps {
  initialData?: any;
  isEdit?: boolean;
}

type TabType = 'general' | 'media' | 'sections' | 'transcript' | 'clips_quiz';
const VALID_TABS: TabType[] = ['general', 'media', 'sections', 'transcript', 'clips_quiz'];

export default function EpisodeEditorForm({ initialData, isEdit = false }: EpisodeEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabQuery = searchParams.get('tab') as TabType | null;
  const initialTab: TabType = tabQuery && VALID_TABS.includes(tabQuery) ? tabQuery : 'general';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (tabQuery && VALID_TABS.includes(tabQuery) && tabQuery !== activeTab) {
      setActiveTab(tabQuery);
    }
  }, [tabQuery]);

  const changeTab = (newTab: TabType) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : '');
    params.set('tab', newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Media upload states
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadStatus, setVideoUploadStatus] = useState<string>('');
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const [audioExtractionStatus, setAudioExtractionStatus] = useState<string>('');

  // Audio extraction from an already-uploaded R2 video
  const [extractingAudioFromR2, setExtractingAudioFromR2] = useState(false);
  const [extractAudioFromR2Status, setExtractAudioFromR2Status] = useState('');
  const [extractAudioFromR2Error, setExtractAudioFromR2Error] = useState<string | null>(null);

  // Deepgram AI Transcription States
  const [deepgramLoading, setDeepgramLoading] = useState(false);
  const [deepgramStatus, setDeepgramStatus] = useState('');
  const [deepgramError, setDeepgramError] = useState<string | null>(null);
  const [generatedSubtitles, setGeneratedSubtitles] = useState<{ srt: string; vtt: string } | null>(null);
  const [copiedSrt, setCopiedSrt] = useState(false);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    description: initialData?.description || '',
    pubDate: initialData?.pubDate ? new Date(initialData.pubDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
    author: initialData?.author || 'Veredillas FM',
    image: initialData?.image || '',
    audioUrl: initialData?.audioUrl || '',
    duration: initialData?.duration || '',
    season: initialData?.season || '',
    episode: initialData?.episode || '',
    videoUrl: initialData?.videoUrl || '',
    tags: Array.isArray(initialData?.tags) ? initialData.tags.join(', ') : initialData?.tags || 'General',
    participants: Array.isArray(initialData?.participants) ? initialData.participants.join(', ') : initialData?.participants || '',
    isPremiere: Boolean(initialData?.isPremiere),
    warningMessage: initialData?.warningMessage || '',
    body: initialData?.body || '',
    sections: initialData?.sections || [{ title: '', time: '00:00' }],
    transcription: initialData?.transcription || [{ time: '00:00', text: '', speaker: '' }],
    clips: initialData?.clips || [{ title: '', url: '' }],
    quiz: initialData?.quiz || [{ question: '', options: ['', '', '', ''], correctAnswer: 0 }],
  });

  const handleTitleChange = (val: string) => {
    const updated: any = { title: val };
    if (!isEdit && !formData.slug) {
      updated.slug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }
    setFormData((prev) => ({ ...prev, ...updated }));
  };

  const uploadR2File = async (file: File, folder: string, target: 'audio' | 'video', entityId?: string) => {
    return uploadFileToR2ViaPresignedUrl(file, { folder, target, entityId });
  };

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output;
  };

  const audioBufferToMp3 = (buffer: AudioBuffer, kbps = 128): Blob => {
    const channels = Math.min(buffer.numberOfChannels, 2);
    const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps);

    const left = floatTo16BitPCM(buffer.getChannelData(0));
    const right = channels === 2 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;

    const sampleBlockSize = 1152; // multiple of 576, expected by the encoder
    const chunks: Uint8Array[] = [];

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      const mp3buf = right
        ? encoder.encodeBuffer(leftChunk, right.subarray(i, i + sampleBlockSize))
        : encoder.encodeBuffer(leftChunk);
      if (mp3buf.length > 0) chunks.push(mp3buf);
    }

    const finalChunk = encoder.flush();
    if (finalChunk.length > 0) chunks.push(finalChunk);

    return new Blob(chunks, { type: 'audio/mpeg' });
  };

  const decodeArrayBufferToMp3 = async (arrayBuffer: ArrayBuffer): Promise<Blob> => {
    const audioContext = new AudioContext();
    try {
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const offlineContext = new OfflineAudioContext(
        decodedBuffer.numberOfChannels,
        decodedBuffer.length,
        decodedBuffer.sampleRate
      );
      const source = offlineContext.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineContext.destination);
      source.start(0);
      const renderedBuffer = await offlineContext.startRendering();
      return audioBufferToMp3(renderedBuffer);
    } finally {
      await audioContext.close();
    }
  };

  const extractAudioFromVideoFile = async (file: File): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    return decodeArrayBufferToWav(arrayBuffer);
  };

  const handleExtractAudioFromUploadedVideo = async () => {
    if (!formData.videoUrl) {
      setExtractAudioFromR2Error('Primero sube un vídeo o añade su URL.');
      return;
    }

    setExtractAudioFromR2Error(null);
    setExtractingAudioFromR2(true);
    setExtractAudioFromR2Status('Descargando vídeo desde R2...');

    try {
      const res = await fetch(`/api/admin/r2-download?url=${encodeURIComponent(formData.videoUrl)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo descargar el vídeo desde R2');
      }
      const arrayBuffer = await res.arrayBuffer();

      setExtractAudioFromR2Status('Extrayendo audio del vídeo...');
      const audioBlob = await decodeArrayBufferToMp3(arrayBuffer);

      setExtractAudioFromR2Status('Subiendo audio extraído al bucket CDN...');
      const baseName = formData.slug || 'episodio';
      const audioFile = new File([audioBlob], `${baseName}.mp3`, { type: 'audio/mpeg' });
      const audioUrl = await uploadR2File(audioFile, 'audios', 'audio', formData.slug);

      setFormData((prev) => ({ ...prev, audioUrl }));
      setExtractAudioFromR2Status('Audio extraído y subido correctamente.');
    } catch (error: any) {
      console.error(error);
      setExtractAudioFromR2Error(error.message || 'Error al extraer el audio del vídeo.');
      setExtractAudioFromR2Status('');
    } finally {
      setExtractingAudioFromR2(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      ...formData,
      season: formData.season ? Number(formData.season) : undefined,
      episode: formData.episode ? Number(formData.episode) : undefined,
      tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags,
      participants: typeof formData.participants === 'string' ? formData.participants.split(',').map((p) => p.trim()).filter(Boolean) : formData.participants,
      sections: formData.sections.filter((s: any) => s.title.trim() !== ''),
      transcription: formData.transcription.filter((t: any) => t.text.trim() !== ''),
      clips: formData.clips.filter((c: any) => c.title.trim() !== '' && c.url.trim() !== ''),
      quiz: formData.quiz.filter((q: any) => q.question.trim() !== ''),
    };

    try {
      const url = isEdit ? `/api/episodes/${initialData._id}` : '/api/episodes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el episodio');

      setSuccessMessage(isEdit ? 'Episodio actualizado con éxito' : 'Episodio creado con éxito');
      setTimeout(() => {
        router.push('/episodes');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al guardar el episodio');
    } finally {
      setSaving(false);
    }
  };

  // Section helpers
  const addSection = () => {
    setFormData((prev) => ({
      ...prev,
      sections: [...prev.sections, { title: '', time: '00:00' }],
    }));
  };

  const removeSection = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateSection = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.sections];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, sections: copy };
    });
  };

  // Transcription helpers
  const addTranscription = () => {
    setFormData((prev) => ({
      ...prev,
      transcription: [...prev.transcription, { time: '00:00', text: '', speaker: '' }],
    }));
  };

  const removeTranscription = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      transcription: prev.transcription.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateTranscription = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.transcription];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, transcription: copy };
    });
  };

  // Clips helpers
  const addClip = () => {
    setFormData((prev) => ({
      ...prev,
      clips: [...prev.clips, { title: '', url: '' }],
    }));
  };

  const removeClip = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      clips: prev.clips.filter((_: any, i: number) => i !== idx),
    }));
  };

  const updateClip = (idx: number, field: string, val: string) => {
    setFormData((prev) => {
      const copy = [...prev.clips];
      copy[idx] = { ...copy[idx], [field]: val };
      return { ...prev, clips: copy };
    });
  };

  const handleClipUploaded = (clip: { title: string; url: string }) => {
    setFormData((prev) => ({
      ...prev,
      clips: [...prev.clips, clip],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/episodes')}
            className="p-2 text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">
              {isEdit ? `Editar Episodio` : 'Nuevo Episodio'}
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              {formData.slug ? `/episodios/${formData.slug}` : 'Configuración de episodio'}
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-5 py-2.5 rounded-lg transition flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? 'Guardando...' : 'Guardar Episodio'}</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg text-xs text-red-300 font-mono">
          {errorMessage}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => changeTab('general')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>1. Información General</span>
        </button>

        <button
          type="button"
          onClick={() => changeTab('media')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'media'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>2. Archivos & R2</span>
        </button>

        <button
          type="button"
          onClick={() => changeTab('transcript')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'transcript'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>3. Transcripción</span>
        </button>
        
        <button
          type="button"
          onClick={() => changeTab('sections')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'sections'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <List className="w-4 h-4" />
          <span>4. Capítulos / Secciones ({formData.sections.length})</span>
        </button>


        <button
          type="button"
          onClick={() => changeTab('clips_quiz')}
          className={`px-4 py-2 text-xs font-medium rounded-t-lg transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'clips_quiz'
              ? 'border-indigo-500 text-indigo-400 bg-zinc-900/60'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>5. Clips & Quiz</span>
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Título del Episodio *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ej: Amor Sin Filtros ft. Saray"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Slug Único *
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="amor-sin-filtros"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Descripción Corta *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Breve resumen del episodio..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Fecha de Publicación
              </label>
              <input
                type="datetime-local"
                value={formData.pubDate}
                onChange={(e) => setFormData({ ...formData, pubDate: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Autor
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Veredillas FM"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Duración (ej: 37 min)
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="37 min"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Temporada
              </label>
              <input
                type="number"
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                placeholder="1"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Nº de Episodio
              </label>
              <input
                type="number"
                value={formData.episode}
                onChange={(e) => setFormData({ ...formData, episode: e.target.value })}
                placeholder="5"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-300">
                <input
                  type="checkbox"
                  checked={formData.isPremiere}
                  onChange={(e) => setFormData({ ...formData, isPremiere: e.target.checked })}
                  className="rounded bg-zinc-950 border-zinc-800 text-indigo-600 focus:ring-0"
                />
                <span>Marcar como Próximo Estreno (Is Premiere)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Etiquetas (separadas por coma)
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="General, Amor, Entrevista"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
                Participantes (separados por coma)
              </label>
              <input
                type="text"
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                placeholder="Saray, Antonieta"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">
              Mensaje de Advertencia (Contenido Sensible)
            </label>
            <input
              type="text"
              value={formData.warningMessage}
              onChange={(e) => setFormData({ ...formData, warningMessage: e.target.value })}
              placeholder="Este episodio contiene lenguaje explícito..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition"
            />
          </div>
        </div>
      )}

      {/* TAB 2: MEDIA & R2 */}
      {activeTab === 'media' && (
        <div className="space-y-6 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <R2Uploader
            label="Imagen de Portada (R2 Upload)"
            accept="image/*"
            folder="images"
            entityId={formData.slug}
            value={formData.image}
            onChange={(url) => setFormData({ ...formData, image: url })}
            helperText="Formato recomendado: WebP / JPG / PNG (16:9 relación de aspecto)."
          />


          <div className="space-y-4 pt-2">
            <R2Uploader
              label="Subir Vídeo (R2 Private Video Bucket)"
              accept="video/*"
              folder="videos"
              target="video"
              entityId={formData.slug}
              value={formData.videoUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, videoUrl: url }))}
              onUploadSuccess={async (file) => {
                setVideoUploadError(null);
                setVideoUploadStatus('Vídeo subido correctamente. Extrayendo audio...');
                setAudioExtractionStatus('');
                setVideoUploading(true);

                try {
                  const audioBlob = await extractAudioFromVideoFile(file);
                  setAudioExtractionStatus('Subiendo audio extraído al bucket CDN...');
                  const audioFileName = file.name.replace(/\.[^/.]+$/, '') + '.mp3';
                  const audioFile = new File([audioBlob], audioFileName, { type: 'audio/mpeg' });
                  const audioUrl = await uploadR2File(audioFile, 'audios', 'audio', formData.slug);
                  setFormData((prev) => ({ ...prev, audioUrl }));
                  setAudioExtractionStatus('Audio extraído y subido correctamente.');
                  setVideoUploadStatus('Carga de vídeo completada.');
                } catch (error: any) {
                  console.error(error);
                  setVideoUploadError(error.message || 'Error al extraer el audio del vídeo.');
                  setVideoUploadStatus('');
                  setAudioExtractionStatus('');
                } finally {
                  setVideoUploading(false);
                }
              }}
              helperText="Sube un archivo de vídeo y extrae automáticamente el audio para el episodio."
            />

            {formData.videoUrl && (
              <div className="p-4 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200">Extraer audio del vídeo ya subido</h4>
                    <p className="text-xs text-zinc-500">
                      {formData.audioUrl
                        ? 'Ya existe un audio asignado. Puedes volver a extraerlo desde el vídeo ya subido a R2.'
                        : 'Este vídeo ya está en R2 pero todavía no tiene audio generado. Extráelo sin volver a subir el archivo.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExtractAudioFromUploadedVideo}
                    disabled={extractingAudioFromR2}
                    className="shrink-0 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-medium px-4 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    {extractingAudioFromR2 ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Music className="w-4 h-4 text-indigo-400" />
                    )}
                    <span>{extractingAudioFromR2 ? 'Extrayendo...' : 'Extraer audio del vídeo en R2'}</span>
                  </button>
                </div>

                {extractAudioFromR2Status && !extractAudioFromR2Error && (
                  <p className="text-xs font-mono text-emerald-400">{extractAudioFromR2Status}</p>
                )}
                {extractAudioFromR2Error && (
                  <p className="text-xs font-mono text-red-400">{extractAudioFromR2Error}</p>
                )}
              </div>
            )}
          </div>

          <R2Uploader
            label="Archivo de Audio Principal (R2 Direct Upload)"
            accept="audio/*"
            folder="audios"
            entityId={formData.slug}
            value={formData.audioUrl}
            onChange={(url) => setFormData({ ...formData, audioUrl: url })}
          />
        </div>
      )}

      {/* TAB 3: TRANSCRIPTION */}
      {activeTab === 'transcript' && (
        <div className="space-y-6 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          {/* Deepgram AI Transcription Generator Box */}
          <div className="bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-purple-950/60 border border-indigo-800/60 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>Transcripción Automática con Deepgram AI</span>
                    <span className="text-[10px] font-mono font-bold bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded">
                      Nova-3
                    </span>
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Genera automáticamente la transcripción con marcas de tiempo e identificación de hablantes usando la IA de Deepgram.
                  </p>
                </div>
              </div>
            </div>

            {/* Input Selection / Audio Status */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
              <div className="md:col-span-8 space-y-1.5">
                <label className="text-zinc-300 font-mono text-[11px] font-semibold">Fuente de Audio / Vídeo</label>
                <input
                  type="text"
                  placeholder="https://pub-<account_id>.r2.dev/audios/ejemplo.mp3"
                  value={formData.audioUrl || formData.videoUrl || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, audioUrl: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[10px] text-zinc-500 block">
                  {formData.audioUrl ? '✓ Usando Audio Principal asignado al episodio' : formData.videoUrl ? '✓ Usando URL de Vídeo del episodio' : 'Pega una URL de audio/vídeo de R2 para transcribir'}
                </span>
              </div>

              <div className="md:col-span-4 flex items-end">
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const sourceUrl = formData.audioUrl || formData.videoUrl;
                    if (!sourceUrl) {
                      setDeepgramError('Por favor añade la URL de audio o vídeo del episodio primero.');
                      return;
                    }
                    setDeepgramError(null);
                    setDeepgramLoading(true);
                    setDeepgramStatus('Enviando audio a Deepgram AI (Nova-3)...');
                    try {
                      const res = await fetch('/api/admin/deepgram/transcribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          url: sourceUrl,
                          model: 'nova-3',
                          language: 'es',
                        }),
                      });
                      if (!res.ok) {
                        const errData = await res.json();
                        throw new Error(errData.error || 'Error en la transcripción con Deepgram');
                      }
                      const data = await res.json();
                      setGeneratedSubtitles({ srt: data.srt, vtt: data.vtt });

                      if (data.utterances && data.utterances.length > 0) {
                        const formatted = data.utterances.map((u: any) => {
                          const m = Math.floor(u.start / 60);
                          const s = Math.floor(u.start % 60);
                          const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                          return {
                            time: timeStr,
                            text: u.transcript.trim(),
                            speaker: u.speaker !== undefined ? `Hablante ${u.speaker}` : '',
                          };
                        });
                        setFormData((prev) => ({ ...prev, transcription: formatted }));
                      } else if (data.transcript) {
                        setFormData((prev) => ({
                          ...prev,
                          transcription: [{ time: '00:00', text: data.transcript.trim(), speaker: 'Hablante 1' }],
                        }));
                      }
                      setDeepgramStatus('¡Transcripción y subtítulos integrados con éxito en el formulario!');
                    } catch (err: any) {
                      console.error(err);
                      setDeepgramError(err.message || 'Error al generar la transcripción');
                    } finally {
                      setDeepgramLoading(false);
                    }
                  }}
                  disabled={deepgramLoading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs shadow-md shadow-indigo-600/20"
                >
                  {deepgramLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Transcribiendo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-indigo-300" />
                      <span>Generar Transcripción</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status & Error Feedback Banners */}
            {deepgramStatus && !deepgramError && (
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-xs font-mono text-indigo-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{deepgramStatus}</span>
              </div>
            )}

            {deepgramError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-xs font-mono text-rose-300 flex items-center gap-2">
                <span className="text-rose-400 font-bold">⚠️ Error:</span>
                <span>{deepgramError}</span>
              </div>
            )}

            {/* Subtitle Export buttons if generated */}
            {generatedSubtitles && (
              <div className="flex items-center gap-3 pt-2 border-t border-indigo-900/40 text-xs font-mono">
                <span className="text-zinc-400 font-bold">Subtítulos Exportables:</span>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([generatedSubtitles.srt], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${formData.slug || 'episodio'}.srt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 rounded bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 transition"
                >
                  Descargar .SRT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([generatedSubtitles.vtt], { type: 'text/vtt' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${formData.slug || 'episodio'}.vtt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2.5 py-1 rounded bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-700 transition"
                >
                  Descargar .VTT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSubtitles.srt);
                    setCopiedSrt(true);
                    setTimeout(() => setCopiedSrt(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
                >
                  {copiedSrt ? '¡SRT Copiado!' : 'Copiar SRT'}
                </button>
              </div>
            )}
          </div>

          

          {/* Existing Manual/AI Line Feed */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Líneas de Transcripción del Episodio</h3>
              <p className="text-xs text-zinc-400">Puedes editar, reordenar o añadir fragmentos manualmente</p>
            </div>

            <button
              type="button"
              onClick={addTranscription}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Añadir Línea</span>
            </button>
          </div>

          <div className="space-y-3">
            {formData.transcription.map((tr: any, idx: number) => (
              <div key={idx} className="bg-zinc-950 p-3 border border-zinc-800/80 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tr.time}
                    onChange={(e) => updateTranscription(idx, 'time', e.target.value)}
                    placeholder="00:00"
                    className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-center"
                  />
                  <input
                    type="text"
                    value={tr.speaker || ''}
                    onChange={(e) => updateTranscription(idx, 'speaker', e.target.value)}
                    placeholder="Hablante"
                    className="w-48 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeTranscription(idx)}
                    className="ml-auto p-1 text-zinc-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={tr.text}
                  onChange={(e) => updateTranscription(idx, 'text', e.target.value)}
                  placeholder="Texto dicho en este fragmento de tiempo..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* TAB 4: SECTIONS / CAPÍTULOS */}
      {activeTab === 'sections' && (
        <div className="space-y-4 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Secciones y Capítulos del Episodio</h3>
              <p className="text-xs text-zinc-400">Añade marcas de tiempo para permitir la navegación por capítulos</p>
            </div>

            <button
              type="button"
              onClick={addSection}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Añadir Sección</span>
            </button>
          </div>

          <div className="space-y-2">
            {formData.sections.map((sec: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2 border border-zinc-800/80 rounded-lg">
                <input
                  type="text"
                  value={sec.time}
                  onChange={(e) => updateSection(idx, 'time', e.target.value)}
                  placeholder="00:00"
                  className="w-24 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-zinc-600"
                />
                <input
                  type="text"
                  value={sec.title}
                  onChange={(e) => updateSection(idx, 'title', e.target.value)}
                  placeholder="Título de la sección (ej: Intro / Bienvenida)"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => removeSection(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CLIPS & QUIZ */}
      {activeTab === 'clips_quiz' && (
        <div className="space-y-6 bg-zinc-900/40 p-6 rounded-xl border border-zinc-800/80">
          {/* Batch upload of clips from the local computer directly to YouTube */}
          <div className="pb-6 border-b border-zinc-800/80">
            <ClipYouTubeBatchUploader onUploaded={handleClipUploaded} />
          </div>

          {/* Clips */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Clips de Vídeo (YouTube Shorts)</h3>
              <button
                type="button"
                onClick={addClip}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Añadir Clip</span>
              </button>
            </div>

            {formData.clips.map((clip: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 bg-zinc-950 p-2 border border-zinc-800/80 rounded-lg">
                <input
                  type="text"
                  value={clip.title}
                  onChange={(e) => updateClip(idx, 'title', e.target.value)}
                  placeholder="Título del clip"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100"
                />
                <input
                  type="text"
                  value={clip.url}
                  onChange={(e) => updateClip(idx, 'url', e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-zinc-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeClip(idx)}
                  className="p-1 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
