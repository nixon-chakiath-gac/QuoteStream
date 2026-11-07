import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getRole } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  if ((await getRole()) !== 'customer') redirect('/gac/dashboard');
  return <>{children}</>;
}
