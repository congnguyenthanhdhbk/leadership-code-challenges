import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { StoreHydrator } from '@/components/providers/StoreHydrator';
import { Toaster } from '@/components/ui/Toaster';

export const metadata: Metadata = {
  title: {
    default: 'Mini Wallet Console',
    template: '%s · Mini Wallet Console',
  },
  description: 'Operator console for the mini wallet service: deposits, PSP callbacks, wagers and turnover-gated withdrawals.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1216' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <StoreHydrator />
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
