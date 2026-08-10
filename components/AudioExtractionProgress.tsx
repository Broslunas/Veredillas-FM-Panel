'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Download, Waves, FileAudio, UploadCloud, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';
import { ExtractionProgress, ExtractionStage, formatBytes, formatEta } from '@/lib/audio-extraction';

const STAGE_META: Record<ExtractionStage, { label: string; icon: LucideIcon }> = {
  downloading: { label: 'Descargar vídeo', icon: Download },
  decoding: { label: 'Decodificar audio', icon: Waves },
  encoding: { label: 'Codificar a MP3', icon: FileAudio },
  uploading: { label: 'Subir audio', icon: UploadCloud },
};

const ALL_STAGES: ExtractionStage[] = ['downloading', 'decoding', 'encoding', 'uploading'];

interface AudioExtractionProgressProps {
  progress: ExtractionProgress | null;
  includeDownloadStage?: boolean;
}

export default function AudioExtractionProgress({
  progress,
  includeDownloadStage = true,
}: AudioExtractionProgressProps) {
  const stages = includeDownloadStage ? ALL_STAGES : ALL_STAGES.filter((s) => s !== 'downloading');
  const currentIndex = progress ? stages.indexOf(progress.stage) : -1;

  // The decode step has no measurable percentage (the Web Audio API gives no
  // progress callback), so surface an elapsed-time counter instead of a fake bar.
  const decodeStartRef = useRef<number | null>(null);
  const [elapsedDecodeSeconds, setElapsedDecodeSeconds] = useState(0);

  useEffect(() => {
    if (progress?.stage !== 'decoding') {
      decodeStartRef.current = null;
      return;
    }
    if (decodeStartRef.current === null) {
      decodeStartRef.current = Date.now();
      setElapsedDecodeSeconds(0);
    }
    const id = setInterval(() => {
      setElapsedDecodeSeconds(Math.floor((Date.now() - (decodeStartRef.current || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [progress?.stage]);

  if (!progress) return null;

  const activeMeta = STAGE_META[progress.stage];

  return (
    <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
      {/* Stepper */}
      <div className="flex items-center">
        {stages.map((stageKey, idx) => {
          const meta = STAGE_META[stageKey];
          const Icon = meta.icon;
          const isDone = currentIndex !== -1 && idx < currentIndex;
          const isActive = idx === currentIndex;

          return (
            <Fragment key={stageKey}>
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border transition ${
                    isDone
                      ? 'bg-emerald-600/20 border-emerald-600 text-emerald-400'
                      : isActive
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-600'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-[9px] font-mono text-center leading-tight ${
                    isActive ? 'text-indigo-300' : isDone ? 'text-emerald-400' : 'text-zinc-600'
                  }`}
                >
                  {meta.label}
                </span>
              </div>
              {idx < stages.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${isDone ? 'bg-emerald-600' : 'bg-zinc-800'}`} />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Active stage detail */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>{activeMeta.label}</span>
          <span>
            {progress.stage === 'decoding'
              ? `${elapsedDecodeSeconds}s transcurridos`
              : progress.percent !== null
                ? `${progress.percent}%${progress.percent < 100 && progress.etaSeconds !== null ? ` · ETA ${formatEta(progress.etaSeconds)}` : ''}`
                : 'procesando...'}
          </span>
        </div>

        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          {progress.percent !== null ? (
            <div
              className="h-full bg-indigo-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.max(2, progress.percent)}%` }}
            />
          ) : (
            <div className="h-full w-1/3 bg-indigo-500 rounded-full animate-pulse" />
          )}
        </div>

        {progress.totalBytes ? (
          <p className="text-[10px] font-mono text-zinc-500">
            {formatBytes(progress.loadedBytes || 0)} / {formatBytes(progress.totalBytes)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
