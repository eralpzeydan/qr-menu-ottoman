// app/admin/layout.tsx
import type { ReactNode } from 'react';
import AdminBoot from './_components/AdminBoot';
import AdminShell from './_components/AdminShell';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      <AdminBoot />
      {children}
    </AdminShell>
  );
}
