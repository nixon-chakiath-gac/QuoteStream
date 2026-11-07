import { redirect } from 'next/navigation';
import { getRole } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const role = await getRole();
  redirect(role === 'gac' ? '/gac/dashboard' : '/portal/request');
}
