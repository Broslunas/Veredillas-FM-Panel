import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import EpisodeContent from '@/models/EpisodeContent';
import BlogPost from '@/models/BlogPost';
import GalleryCategory from '@/models/GalleryCategory';
import { isAuthorizedAdmin } from '@/lib/api-guard';
import { logAudit } from '@/lib/audit-log';
import type { AuditAction } from '@/models/AuditLog';
import { can, type PermissionSection } from '@/lib/permissions';
import type { BulkAction } from '@/lib/bulk';

const MAX_ITEMS = 200;

interface CollectionConfig {
  model: any;
  section: PermissionSection;
  resource: string;
  labelField: string;
  actions: BulkAction[];
  /** Gallery has no `deletedAt`, so deleting there is permanent. */
  softDelete: boolean;
}

const COLLECTIONS: Record<string, CollectionConfig> = {
  episodes: {
    model: EpisodeContent,
    section: 'episodes',
    resource: 'episode',
    labelField: 'title',
    actions: ['publish', 'unpublish', 'delete', 'tag_add', 'tag_remove'],
    softDelete: true,
  },
  blog: {
    model: BlogPost,
    section: 'blog',
    resource: 'blog',
    labelField: 'title',
    actions: ['delete', 'tag_add', 'tag_remove'],
    softDelete: true,
  },
  gallery: {
    model: GalleryCategory,
    section: 'gallery',
    resource: 'gallery',
    labelField: 'category',
    actions: ['delete'],
    softDelete: false,
  },
};

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export async function POST(request: Request) {
  // Panel access is checked before anything else is parsed; the section a
  // request targets only becomes relevant once we know who is asking.
  const { authorized, user } = await isAuthorizedAdmin(request);
  if (!authorized || !user) {
    return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la petición no válido' }, { status: 400 });
  }

  const { collection, action, ids } = body || {};
  const config = COLLECTIONS[collection];
  if (!config) {
    return NextResponse.json({ error: 'Colección no válida' }, { status: 400 });
  }

  if (!can(user.permissions, config.section, 'write')) {
    return NextResponse.json({ error: 'Sin permisos para modificar esta sección' }, { status: 403 });
  }

  if (!config.actions.includes(action)) {
    return NextResponse.json(
      { error: `La acción "${action}" no está disponible para esta colección` },
      { status: 400 }
    );
  }

  const validIds = Array.isArray(ids)
    ? ids.filter((id: unknown) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
    : [];

  if (validIds.length === 0) {
    return NextResponse.json({ error: 'No se recibió ningún elemento válido' }, { status: 400 });
  }
  if (validIds.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Demasiados elementos seleccionados (máximo ${MAX_ITEMS})` },
      { status: 400 }
    );
  }

  const tags = normalizeTags(body.tags);
  if ((action === 'tag_add' || action === 'tag_remove') && tags.length === 0) {
    return NextResponse.json({ error: 'Indica al menos una etiqueta' }, { status: 400 });
  }

  await dbConnect();

  const filter = { _id: { $in: validIds } };
  // Labels are read before the write so the audit entry survives deletions.
  const affected = await config.model
    .find(filter)
    .select(`${config.labelField} _id`)
    .lean();

  let modified = 0;
  let auditAction: AuditAction = 'update';

  switch (action) {
    case 'publish': {
      const res = await config.model.updateMany(filter, { $set: { status: 'published' } });
      modified = res.modifiedCount ?? 0;
      break;
    }
    case 'unpublish': {
      const res = await config.model.updateMany(filter, { $set: { status: 'draft' } });
      modified = res.modifiedCount ?? 0;
      break;
    }
    case 'tag_add': {
      const res = await config.model.updateMany(filter, { $addToSet: { tags: { $each: tags } } });
      modified = res.modifiedCount ?? 0;
      break;
    }
    case 'tag_remove': {
      const res = await config.model.updateMany(filter, { $pull: { tags: { $in: tags } } });
      modified = res.modifiedCount ?? 0;
      break;
    }
    case 'delete': {
      if (config.softDelete) {
        const res = await config.model.updateMany(filter, { $set: { deletedAt: new Date() } });
        modified = res.modifiedCount ?? 0;
        auditAction = 'delete';
      } else {
        const res = await config.model.deleteMany(filter);
        modified = res.deletedCount ?? 0;
        auditAction = 'permanent_delete';
      }
      break;
    }
  }

  await logAudit({
    actor: user,
    action: auditAction,
    resource: config.resource,
    label: `Acción en bloque sobre ${modified} elemento(s)`,
    metadata: {
      bulkAction: action,
      requested: validIds.length,
      modified,
      ...(tags.length > 0 ? { tags } : {}),
      // Kept short so a 200-item bulk doesn't bloat the audit entry.
      items: affected.slice(0, 25).map((doc: any) => ({
        id: doc._id.toString(),
        label: doc[config.labelField],
      })),
      ...(affected.length > 25 ? { itemsTruncated: affected.length - 25 } : {}),
    },
  });

  return NextResponse.json({ success: true, modified });
}
