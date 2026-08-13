'use client';

import { useEffect, useRef, useState } from 'react';
import { Languages, Trash2, RefreshCw, CheckCircle2, AlertCircle, Loader2, PlayCircle, Mic2 } from 'lucide-react';
import DubbingProgress, { type DubbingProgressSnapshot } from '@/components/DubbingProgress';

interface DubbingManagerProps {
  episodeId: string;
  episodeSlug: string;
  sourceUrl: string;
  initialDubs?: any[];
}

interface AuraVoice {
  name?: string;
  canonical_name: string;
  languages: string[];
  metadata?: { accent?: string; display_name?: string; tags?: string[] };
}

function voiceGenderLabel(voice: AuraVoice): string | null {
  const tags = voice.metadata?.tags || [];
  if (tags.includes('feminine')) return 'Femenina';
  if (tags.includes('masculine')) return 'Masculina';
  return null;
}

function voiceDisplayName(voice: AuraVoice): string {
  return voice.metadata?.display_name || voice.name || voice.canonical_name;
}

interface DubTrackSummary {
  lang: string;
  label: string;
  status: string;
  progress: number;
  totalCount?: number;
  translatedCount?: number;
  synthesizedCount?: number;
  errorCount?: number;
  maxDriftSeconds?: number;
  url?: string;
  error?: string;
  hasStarted: boolean;
  speakerIds?: number[];
  voiceMap?: Record<string, string>;
  speakerNames?: Record<string, string>;
}

interface PendingVoiceSelection {
  lang: string;
  label: string;
  speakerIds: number[];
  voiceMap: Record<string, string>;
  speakerNames: Record<string, string>;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'Inglés',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  pt: 'Portugués',
  ca: 'Catalán',
  eu: 'Euskera',
  gl: 'Gallego',
  nl: 'Neerlandés',
  ru: 'Ruso',
  ar: 'Árabe',
  zh: 'Chino',
  ja: 'Japonés',
  ko: 'Coreano',
  es: 'Español',
};

function labelForLang(code: string): string {
  const base = code.split('-')[0];
  return LANGUAGE_LABELS[base] || code.toUpperCase();
}

function summarizeTrack(t: any): DubTrackSummary {
  const segments = Array.isArray(t.segments) ? t.segments : [];
  return {
    lang: t.lang,
    label: t.label,
    status: t.status,
    progress: t.progress || 0,
    totalCount: segments.length || undefined,
    translatedCount: segments.filter((s: any) => s.status !== 'pending').length,
    synthesizedCount: segments.filter((s: any) => s.status === 'synthesized' || s.status === 'error').length,
    errorCount: segments.filter((s: any) => s.status === 'error').length,
    maxDriftSeconds: t.maxDriftSeconds,
    url: t.url,
    error: t.error,
    hasStarted: true,
    speakerIds: Array.from(new Set(segments.map((s: any) => s.speaker ?? 0))) as number[],
    voiceMap: t.voiceMap || {},
    speakerNames: t.speakerNames || {},
  };
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data;
}

export default function DubbingManager({ episodeId, episodeSlug, sourceUrl, initialDubs }: DubbingManagerProps) {
  const [tracks, setTracks] = useState<DubTrackSummary[]>(() => (initialDubs || []).map(summarizeTrack));
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [voiceCatalog, setVoiceCatalog] = useState<AuraVoice[]>([]);
  const [selectedLang, setSelectedLang] = useState('');
  const [busyLang, setBusyLang] = useState<string | null>(null);
  const [progress, setProgress] = useState<DubbingProgressSnapshot | null>(null);
  const [pendingVoiceSelection, setPendingVoiceSelection] = useState<PendingVoiceSelection | null>(null);
  const tracksRef = useRef<DubTrackSummary[]>(tracks);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    fetch('/api/admin/dubbing/voices')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.languages)) {
          setAvailableLanguages(data.languages);
          if (!selectedLang && data.languages.length > 0) setSelectedLang(data.languages[0]);
        }
        if (Array.isArray(data.voices)) setVoiceCatalog(data.voices);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh counts for any track that was left mid-pipeline from a previous session.
  useEffect(() => {
    (initialDubs || [])
      .filter((t) => t.status !== 'ready' && t.status !== 'error' && t.status !== 'awaiting_voices')
      .forEach((t) => {
        const params = new URLSearchParams({ episodeId, lang: t.lang });
        fetch(`/api/admin/dubbing/status?${params}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.error) return;
            upsertTrack({
              lang: t.lang,
              status: data.status,
              progress: data.progress,
              totalCount: data.totalCount,
              translatedCount: data.translatedCount + data.synthesizedCount + data.errorCount,
              synthesizedCount: data.synthesizedCount + data.errorCount,
              errorCount: data.errorCount,
              maxDriftSeconds: data.maxDriftSeconds,
              url: data.url,
            });
          })
          .catch(() => {});
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function upsertTrack(patch: Partial<DubTrackSummary> & { lang: string }) {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.lang === patch.lang);
      if (idx === -1) {
        return [...prev, { label: patch.lang, status: 'segmenting', progress: 0, hasStarted: false, ...patch }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  function voicesForLang(lang: string): AuraVoice[] {
    return voiceCatalog.filter(
      (v) => Array.isArray(v.languages) && v.languages.some((l) => l === lang || l.startsWith(`${lang}-`))
    );
  }

  async function continuePipeline(lang: string) {
    setBusyLang(lang);
    try {
      for (;;) {
        const res = await postJson('/api/admin/dubbing/translate-batch', { episodeId, lang, batchSize: 25 });
        setProgress({
          stage: 'translating',
          percent: res.totalCount ? Math.round((res.translatedCount / res.totalCount) * 100) : null,
          detail: `${res.translatedCount}/${res.totalCount} segmentos traducidos`,
        });
        upsertTrack({ lang, translatedCount: res.translatedCount, totalCount: res.totalCount });
        if (res.done) break;
      }

      for (;;) {
        const res = await postJson('/api/admin/dubbing/synthesize-batch', { episodeId, lang, batchSize: 5 });
        const errCount = res.errors?.length ? res.errors.length : 0;
        setProgress({
          stage: 'synthesizing',
          percent: res.totalCount ? Math.round((res.synthesizedCount / res.totalCount) * 100) : null,
          detail: `${res.synthesizedCount}/${res.totalCount} segmentos sintetizados${errCount ? ` · ${errCount} con error` : ''}`,
        });
        upsertTrack({ lang, synthesizedCount: res.synthesizedCount, totalCount: res.totalCount });
        if (res.done) break;
      }

      setProgress({ stage: 'finalizing', percent: null, detail: 'Ensamblando y subiendo el audio final…' });
      const finalRes = await postJson('/api/admin/dubbing/finalize', { episodeId, lang });
      upsertTrack({ lang, status: 'ready', progress: 100, url: finalRes.url, maxDriftSeconds: finalRes.maxDriftSeconds });
      setProgress(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar el doblaje';
      upsertTrack({ lang, status: 'error', error: message });
      setProgress(null);
    } finally {
      setBusyLang(null);
    }
  }

  async function startDub(lang: string, label: string) {
    setBusyLang(lang);
    upsertTrack({ lang, label, status: 'segmenting', progress: 0, hasStarted: false, error: undefined });
    try {
      setProgress({ stage: 'transcribing', percent: null, detail: 'Transcribiendo y segmentando el audio original…' });
      const res = await postJson('/api/admin/dubbing/start', { episodeId, lang, label });
      upsertTrack({
        lang,
        label,
        status: 'awaiting_voices',
        totalCount: res.totalSegments,
        hasStarted: true,
        speakerIds: res.speakerIds,
        voiceMap: res.voiceMap,
        speakerNames: res.speakerNames,
        error: undefined,
      });
      setProgress(null);
      setPendingVoiceSelection({
        lang,
        label,
        speakerIds: res.speakerIds,
        voiceMap: res.voiceMap,
        speakerNames: res.speakerNames || {},
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al generar el doblaje';
      upsertTrack({ lang, status: 'error', error: message });
      setProgress(null);
    } finally {
      setBusyLang(null);
    }
  }

  async function confirmVoices() {
    if (!pendingVoiceSelection) return;
    const { lang, voiceMap } = pendingVoiceSelection;
    setBusyLang(lang);
    try {
      await postJson('/api/admin/dubbing/set-voices', { episodeId, lang, voiceMap });
      upsertTrack({ lang, status: 'translating', voiceMap });
      setPendingVoiceSelection(null);
      setBusyLang(null);
      await continuePipeline(lang);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar las voces';
      upsertTrack({ lang, status: 'error', error: message });
      setBusyLang(null);
    }
  }

  function handleResumeOrRetry(t: DubTrackSummary) {
    if (!t.hasStarted) {
      startDub(t.lang, t.label || labelForLang(t.lang));
      return;
    }
    if (t.status === 'awaiting_voices') {
      setPendingVoiceSelection({
        lang: t.lang,
        label: t.label,
        speakerIds: t.speakerIds && t.speakerIds.length > 0 ? t.speakerIds : [0],
        voiceMap: t.voiceMap || {},
        speakerNames: t.speakerNames || {},
      });
      return;
    }
    continuePipeline(t.lang);
  }

  async function handleDelete(lang: string) {
    if (!confirm(`¿Eliminar la pista de doblaje en "${labelForLang(lang)}"?`)) return;
    try {
      await fetch('/api/admin/dubbing', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, lang }),
      });
      setTracks((prev) => prev.filter((t) => t.lang !== lang));
      if (pendingVoiceSelection?.lang === lang) setPendingVoiceSelection(null);
    } catch {
      alert('No se pudo eliminar la pista de doblaje.');
    }
  }

  const usedLanguages = new Set(tracks.filter((t) => t.status !== 'error').map((t) => t.lang));
  const selectableLanguages = availableLanguages.filter((l) => !usedLanguages.has(l));

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Languages className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-100">Doblaje de audio</h4>
            <p className="text-xs text-zinc-400">
              Genera una pista de audio traducida (voz sintética) para que el vídeo pueda escucharse en otro idioma.
            </p>
          </div>
        </div>
      </div>

      {!sourceUrl ? (
        <p className="text-xs text-zinc-500">Añade un audio o vídeo al episodio para poder generar un doblaje.</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            disabled={Boolean(busyLang) || selectableLanguages.length === 0}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100 disabled:opacity-60 focus:outline-none focus:border-zinc-600"
          >
            {selectableLanguages.length === 0 && <option value="">Sin idiomas disponibles</option>}
            {selectableLanguages.map((code) => (
              <option key={code} value={code}>
                {labelForLang(code)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={Boolean(busyLang) || !selectedLang}
            onClick={() => startDub(selectedLang, labelForLang(selectedLang))}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            {busyLang === selectedLang ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            <span>Generar doblaje</span>
          </button>
        </div>
      )}

      {pendingVoiceSelection && (
        <div className="bg-zinc-950 border border-indigo-800/60 rounded-lg p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <p className="text-xs font-semibold text-zinc-200">
              Elige una voz para cada persona que habla ({labelForLang(pendingVoiceSelection.lang)})
            </p>
          </div>
          <p className="text-[11px] text-zinc-500">
            Se han detectado {pendingVoiceSelection.speakerIds.length} hablante(s) distinto(s). Asignar una voz
            distinta a cada uno facilita seguir la conversación.
          </p>

          <div className="space-y-2">
            {pendingVoiceSelection.speakerIds.map((speakerId) => {
              const options = voicesForLang(pendingVoiceSelection.lang);
              const key = String(speakerId);
              const speakerLabel = pendingVoiceSelection.speakerNames[key] || `Hablante ${speakerId + 1}`;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300 font-medium w-28 shrink-0 truncate" title={speakerLabel}>
                    {speakerLabel}
                  </span>
                  <select
                    value={pendingVoiceSelection.voiceMap[key] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPendingVoiceSelection((prev) =>
                        prev ? { ...prev, voiceMap: { ...prev.voiceMap, [key]: value } } : prev
                      );
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {options.length === 0 && <option value="">Sin voces disponibles</option>}
                    {options.map((v) => {
                      const gender = voiceGenderLabel(v);
                      return (
                        <option key={v.canonical_name} value={v.canonical_name} className="bg-zinc-900 text-white">
                          {voiceDisplayName(v)}
                          {v.metadata?.accent ? ` · ${v.metadata.accent}` : ''}
                          {gender ? ` · ${gender}` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={confirmVoices}
            disabled={Boolean(busyLang)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
          >
            {busyLang === pendingVoiceSelection.lang ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Confirmar voces y continuar</span>
          </button>
        </div>
      )}

      {progress && <DubbingProgress progress={progress} />}

      {tracks.length > 0 && (
        <div className="space-y-2">
          {tracks.map((t) => (
            <div key={t.lang} className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-zinc-200">{t.label || labelForLang(t.lang)}</span>

                {t.status === 'ready' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {t.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                {busyLang === t.lang && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}

                <span className="text-[10px] font-mono text-zinc-500 uppercase">{t.status}</span>

                <div className="ml-auto flex items-center gap-2">
                  {t.status === 'ready' && t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-emerald-400 hover:text-emerald-300 transition"
                      title="Escuchar doblaje"
                    >
                      <PlayCircle className="w-4 h-4" />
                    </a>
                  )}

                  {t.status !== 'ready' && busyLang !== t.lang && !(pendingVoiceSelection?.lang === t.lang) && (
                    <button
                      type="button"
                      onClick={() => handleResumeOrRetry(t)}
                      disabled={Boolean(busyLang)}
                      className="p-1 text-amber-400 hover:text-amber-300 transition disabled:opacity-50"
                      title={t.status === 'error' ? 'Reintentar' : t.status === 'awaiting_voices' ? 'Elegir voces' : 'Reanudar'}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(t.lang)}
                    disabled={busyLang === t.lang}
                    className="p-1 text-zinc-500 hover:text-red-400 transition disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {typeof t.totalCount === 'number' &&
                ['translating', 'synthesizing', 'finalizing', 'error'].includes(t.status) && (
                  <p className="text-[11px] font-mono text-zinc-500">
                    {t.synthesizedCount || 0}/{t.totalCount} segmentos sintetizados
                    {t.errorCount ? ` · ${t.errorCount} con error` : ''}
                  </p>
                )}

              {t.status === 'ready' && typeof t.maxDriftSeconds === 'number' && (
                <p className="text-[11px] font-mono text-zinc-500">
                  Desfase máximo respecto al audio original: {t.maxDriftSeconds.toFixed(1)}s
                </p>
              )}

              {t.status === 'error' && t.error && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
