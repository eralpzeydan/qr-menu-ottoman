'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

type Props = { children: React.ReactNode };

const navLinks = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Ürünler' },
  { href: '/admin/categories', label: 'Kategoriler' },
];

export default function AdminShell({ children }: Props) {
  const pathname = usePathname();
  const hideNav = pathname?.startsWith('/admin/login');

  const activeMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    navLinks.forEach((link) => {
      const isDashboard = link.href === '/admin';
      const active = isDashboard
        ? pathname === '/admin' || pathname === '/admin/'
        : pathname === link.href || Boolean(pathname?.startsWith(`${link.href}/`));
      map[link.href] = active;
    });
    return map;
  }, [pathname]);

  return (
    <div className="admin-dark min-h-screen bg-slate-950 text-slate-100">
      {!hideNav && (
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900 text-white shadow">
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
            <nav className="flex flex-1 flex-wrap items-center gap-2 text-white">
              {navLinks.map((link) => {
                const active = activeMap[link.href];
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-emerald-500 text-slate-900 shadow-sm'
                        : 'text-slate-100 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
      )}
      {children}
    </div>
  );
}
