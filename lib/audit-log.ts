import dbConnect from '@/lib/mongodb';
import AuditLog, { AuditAction } from '@/models/AuditLog';
import type { JWTPayload } from '@/lib/auth';

const MAX_VALUE_LENGTH = 300;

function summarizeValue(value: unknown): unknown {
  if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
    return `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} caracteres)`;
  }
  if (Array.isArray(value)) return `[${value.length} elemento(s)]`;
  if (value && typeof value === 'object') return '[objeto]';
  return value;
}

/**
 * Compares `before` vs `after` only for the given field names and returns a
 * summarized diff, skipping fields whose serialized value didn't change.
 */
export function buildFieldChanges(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
  fields: string[]
): Record<string, { before: unknown; after: unknown }> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const field of fields) {
    const b = before?.[field];
    const a = after?.[field];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    changes[field] = { before: summarizeValue(b), after: summarizeValue(a) };
  }
  return changes;
}

interface LogAuditParams {
  actor: JWTPayload;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  label?: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    if (params.changes && Object.keys(params.changes).length === 0) return;

    await dbConnect();
    await AuditLog.create({
      actorId: params.actor.userId,
      actorName: params.actor.name,
      actorEmail: params.actor.email,
      actorRole: params.actor.role,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      label: params.label,
      changes: params.changes,
      metadata: params.metadata,
    });
  } catch (err) {
    console.error('Error writing audit log:', err);
  }
}
