'use client';

import { Fragment } from 'react';
import { Mic, Languages, AudioWaveform, Layers, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react';

export type DubbingStage = 'transcribing' | 'translating' | 'synthesizing' | 'finalizing';

export interface DubbingProgressSnapshot {
  stage: DubbingStage;
  percent: number | null;
  detail?: string;
}

const STAGE_META: Record<DubbingStage, { label: string; icon: LucideIcon }> = {
  transcribing: { label: 'Transcribir', icon: Mic },
  translating: { label: 'Traducir', icon: Languages },
  synthesizing: { label: 'Sintetizar voz', icon: AudioWaveform },
  finalizing: { label: 'Ensamblar', icon: Layers },
};

const ALL_STAGES: DubbingStage[] = ['transcribing', 'translating', 'synthesizing', 'finalizing'];

interface DubbingProgressProps {
  progress: DubbingProgressSnapshot | null;
}

export default function DubbingProgress({ progress }: DubbingProgressProps) {
  if (!progress) return null;

  const currentIndex = ALL_STAGES.indexOf(progress.stage);
  const activeMeta = STAGE_META[progress.stage];

  return (
    <div className="space-y-3 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
      {/* Stepper */}
      <div className="flex items-center">
        {ALL_STAGES.map((stageKey, idx) => {
          const meta = STAGE_META[stageKey];
          const Icon = meta.icon;
          const isDone = idx < currentIndex;
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
              {idx < ALL_STAGES.length - 1 && (
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
          <span>{progress.detail || (progress.percent !== null ? `${progress.percent}%` : 'procesando...')}</span>
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
      </div>
    </div>
  );
}
