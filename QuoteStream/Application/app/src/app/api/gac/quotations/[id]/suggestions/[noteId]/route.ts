import { route, body } from '@/lib/server/api';
import { acceptSuggestion, dismissSuggestion, loadDraft, FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; noteId: string }> };

export const POST = route<Ctx>('gac', async (req, ctx) => {
  const p = await ctx.params;
  const id = Number(p.id);
  const noteId = Number(p.noteId);
  if (!Number.isInteger(id) || !Number.isInteger(noteId)) throw new FlowError('Not found', 404);
  const b = await body(req);
  if (b.action === 'accept') await acceptSuggestion(id, noteId);
  else if (b.action === 'dismiss') await dismissSuggestion(id, noteId);
  else throw new FlowError('Unknown action');
  return loadDraft(id, { markOpened: false });
});
