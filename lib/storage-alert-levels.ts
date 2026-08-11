export interface StorageAlertLevel {
  threshold: number;
  label: string;
  emoji: string;
  color: string;
}

// Niveles escalonados de aviso a medida que un bucket se acerca a su límite.
export const STORAGE_ALERT_LEVELS: StorageAlertLevel[] = [
  { threshold: 75, label: 'Aviso', emoji: '⚠️', color: '#f59e0b' },
  { threshold: 83, label: 'Atención', emoji: '🟠', color: '#f97316' },
  { threshold: 90, label: 'Advertencia crítica', emoji: '🔴', color: '#ef4444' },
  { threshold: 98, label: 'Urgente', emoji: '🔴', color: '#b91c1c' },
];

export function getActiveAlertThreshold(percentUsed: number): number {
  let active = 0;
  for (const level of STORAGE_ALERT_LEVELS) {
    if (percentUsed >= level.threshold) active = level.threshold;
  }
  return active;
}

export function getAlertLevelForThreshold(threshold: number): StorageAlertLevel | undefined {
  return STORAGE_ALERT_LEVELS.find((level) => level.threshold === threshold);
}
