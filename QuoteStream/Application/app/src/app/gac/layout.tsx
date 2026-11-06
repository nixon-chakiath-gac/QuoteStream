import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getRole } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function GacLayout({ children }: { children: ReactNode }) {
  if ((await getRole()) !== 'gac') redirect('/portal/request');
  return <>{children}</>;
}
