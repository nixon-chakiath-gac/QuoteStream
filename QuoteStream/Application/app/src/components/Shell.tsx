'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/client';

type Role = 'customer' | 'gac';

const NAV = [
  { href: '/gac/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/gac/requests', label: 'Requests', icon: '☰' },
  { href: '/gac/approvals', label: 'Approvals', icon: '✓' },
  { href: '/gac/email', label: 'Email simulator', icon: '✉' },
  { href: '/gac/settings', label: 'Settings', icon: '⚙' }
];

export default function Shell({ role, children }: { role: Role; children: ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);

  async function switchTo(r: Role) {
    await api('/api/role', { body: { role: r } });
    window.location.href = r === 'gac' ? '/gac/dashboard' : '/portal/request';
  }

  const name = role === 'gac' ? 'Christine Zock' : 'Blue Dune Energy';
  const initials = role === 'gac' ? 'CZ' : 'BD';

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="QuoteStream">
          <img className="brand-logo" src="/gac-logo.png" alt="GAC" />
          <span className="brand-divider" />
          <span className="brand-text">
            <span className="brand-name">
              <span className="b1">Quote</span><span className="b2">Stream</span>
            </span>
            <span className="brand-tag">Capture | Automate | Quote | Move forward</span>
          </span>
        </Link>
        {role === 'gac' && <input className="searchbox" placeholder="Search requests" aria-label="Search requests" />}
        <div className="spacer" />
        <button className="avatar-btn" aria-label="Notifications" title="Notifications">
          {'\u{1F514}'}
        </button>
        <button className="avatar-btn" onClick={() => setMenu(!menu)} aria-label="Switch user">
          <span className="avatar">{initials}</span>
          <span>{name}</span>
          <span>{'▾'}</span>
        </button>
        {menu && (
          <div className="menu" role="menu">
            <button className={role === 'customer' ? 'active' : ''} onClick={() => switchTo('customer')}>
              Customer
              <span className="small">Blue Dune Energy</span>
            </button>
            <button className={role === 'gac' ? 'active' : ''} onClick={() => switchTo('gac')}>
              GAC user
              <span className="small">Christine Zock</span>
            </button>
          </div>
        )}
      </header>
      {role === 'customer' ? (
        <>
          <nav className="tabs-bar">
            <Link href="/portal/request" className={`tab${path.startsWith('/portal/request') && !path.startsWith('/portal/requests') ? ' active' : ''}`}>
              Request a quotation
            </Link>
            <Link href="/portal/requests" className={`tab${path.startsWith('/portal/requests') ? ' active' : ''}`}>
              My requests
            </Link>
          </nav>
          <main className="customer-content">{children}</main>
        </>
      ) : (
        <div className="layout">
          <aside className={`sidebar${open ? ' open' : ''}`}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`nav-item${path.startsWith(n.href) || (n.href === '/gac/requests' && path.startsWith('/gac/quotations')) ? ' active' : ''}`} title={n.label}>
                <span className="nav-icon">{n.icon}</span>
                <span className="nav-label">{n.label}</span>
              </Link>
            ))}
            <div className="grow" />
            <button className="close-sidebar" onClick={() => setOpen(!open)}>
              {open ? '« Close sidebar' : '»'}
            </button>
          </aside>
          <main className="content">{children}</main>
        </div>
      )}
    </>
  );
}
