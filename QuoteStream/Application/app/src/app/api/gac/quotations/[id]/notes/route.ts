import { route, body, idOf, type IdCtx } from '@/lib/server/api';
import { loadDraft, saveNote } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const POST = route<IdCtx>('gac', async (req, ctx) => {
  const id = await idOf(ctx);
  const b = await body(req);
  await saveNote(id, { change: b.change, reason: b.reason, reason_text: b.reason_text, free_text: b.free_text });
  return loadDraft(id, { markOpened: false });
});
