/** Shared vocabulary for the bulk actions endpoint (app/api/bulk/route.ts). */

export type BulkAction = 'publish' | 'unpublish' | 'delete' | 'tag_add' | 'tag_remove';

export type BulkCollection = 'episodes' | 'blog' | 'gallery';

export const BULK_ACTION_LABELS: Record<BulkAction, string> = {
  publish: 'Publicar',
  unpublish: 'Pasar a borrador',
  delete: 'Eliminar',
  tag_add: 'Añadir etiquetas',
  tag_remove: 'Quitar etiquetas',
};
