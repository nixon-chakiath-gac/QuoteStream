import './globals.css';
import type { ReactNode } from 'react';
import { getRole } from '@/lib/server/auth';
import Shell from '@/components/Shell';

export const metadata = { title: 'QuoteStream' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const role = await getRole();
  return (
    <html lang="en">
      <body>
        <Shell role={role}>{children}</Shell>
      </body>
    </html>
  );
}
