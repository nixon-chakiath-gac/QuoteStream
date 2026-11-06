import { route, body } from '@/lib/server/api';
import { q } from '@/lib/db';
import { createEmailRequest, FlowError } from '@/lib/server/flow';

export const dynamic = 'force-dynamic';

export const GET = route('gac', async () => {
  return q('SELECT id, file_name, label, from_email, to_email, subject, body FROM sample_email ORDER BY file_name');
});

export const POST = route('gac', async (req) => {
  const b = await body(req);
  const email = {
    from: String(b.from ?? '').trim(),
    to: String(b.to ?? '').trim(),
    subject: String(b.subject ?? '').trim(),
    body: String(b.body ?? '').trim()
  };
  if (!email.from || !email.body) throw new FlowError('An email needs a sender and a body');
  return createEmailRequest(email);
});
