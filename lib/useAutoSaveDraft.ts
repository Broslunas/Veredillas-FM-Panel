'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// How often (in ms) in-progress form data is persisted to localStorage.
export const AUTO_SAVE_INTERVAL_MS = 20000;

interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

interface UseAutoSaveDraftOptions {
  intervalMs?: number;
  enabled?: boolean;
  confirmOnClose?: boolean;
}

interface UseAutoSaveDraftResult<T> {
  isDirty: boolean;
  lastAutoSavedAt: Date | null;
  draftAvailable: boolean;
  draftSavedAt: Date | null;
  restoreDraft: () => T | null;
  discardDraft: () => void;
  markSaved: () => void;
}

/**
 * Periodically persists `data` to localStorage under `key` so in-progress
 * edits survive an accidental tab close/reload/crash, and warns before the
 * tab closes while there are changes that haven't reached the server yet.
 * Pass `key: null` to disable persistence (e.g. while the entity id isn't
 * known yet) while still getting the beforeunload guard.
 */
export function useAutoSaveDraft<T>(
  key: string | null,
  data: T,
  options: UseAutoSaveDraftOptions = {}
): UseAutoSaveDraftResult<T> {
  const { intervalMs = AUTO_SAVE_INTERVAL_MS, enabled = true, confirmOnClose = true } = options;
  const storageKey = key ? `veredillas:autosave:${key}` : null;

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  // Snapshot of the last data known to be safe on the server (initial load,
  // or right after a successful save via `markSaved`). Comparing against
  // this — rather than the last autosave — is what drives the "unsaved
  // changes" warning, since a localStorage draft isn't a server save.
  const baselineRef = useRef(JSON.stringify(data));
  const lastAutoSavedSnapshotRef = useRef<string | null>(null);
  const pendingDraftRef = useRef<T | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<Date | null>(null);
  const [draft, setDraft] = useState<{ available: boolean; savedAt: Date | null }>({
    available: false,
    savedAt: null,
  });

  // Look for a leftover draft from a previous session as soon as we know the
  // key. This has to run post-mount (not during the render itself) since
  // localStorage isn't available during server rendering — the resulting
  // state update only affects the recovery banner, so a same-tick re-render
  // here doesn't cause any visible flicker.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed: StoredDraft<T> = JSON.parse(raw);
      if (JSON.stringify(parsed.data) !== baselineRef.current) {
        pendingDraftRef.current = parsed.data;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of an external store (localStorage) that isn't available during SSR/render
        setDraft({ available: true, savedAt: new Date(parsed.savedAt) });
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Malformed/unavailable draft — ignore it.
    }
  }, [storageKey]);

  useEffect(() => {
    setIsDirty(JSON.stringify(data) !== baselineRef.current);
  }, [data]);

  // Ticks on a fixed interval (reading the latest data via a ref) rather
  // than resetting on every keystroke, so autosave keeps firing even while
  // the user is actively typing.
  useEffect(() => {
    if (!storageKey || !enabled) return;
    const id = window.setInterval(() => {
      const serialized = JSON.stringify(dataRef.current);
      if (serialized === baselineRef.current || serialized === lastAutoSavedSnapshotRef.current) return;
      try {
        const entry: StoredDraft<T> = { data: dataRef.current, savedAt: new Date().toISOString() };
        window.localStorage.setItem(storageKey, JSON.stringify(entry));
        lastAutoSavedSnapshotRef.current = serialized;
        setLastAutoSavedAt(new Date());
      } catch {
        // Storage full or unavailable — nothing else we can do client-side.
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [storageKey, enabled, intervalMs]);

  useEffect(() => {
    if (!confirmOnClose) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(dataRef.current) === baselineRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [confirmOnClose]);

  const restoreDraft = useCallback((): T | null => {
    setDraft({ available: false, savedAt: null });
    return pendingDraftRef.current;
  }, []);

  const discardDraft = useCallback(() => {
    pendingDraftRef.current = null;
    setDraft({ available: false, savedAt: null });
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  const markSaved = useCallback(() => {
    const serialized = JSON.stringify(dataRef.current);
    baselineRef.current = serialized;
    lastAutoSavedSnapshotRef.current = serialized;
    setIsDirty(false);
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }, [storageKey]);

  return {
    isDirty,
    lastAutoSavedAt,
    draftAvailable: draft.available,
    draftSavedAt: draft.savedAt,
    restoreDraft,
    discardDraft,
    markSaved,
  };
}
