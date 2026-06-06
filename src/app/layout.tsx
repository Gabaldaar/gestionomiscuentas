import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { AccountProvider } from '@/components/context/AccountProvider';

export const metadata: Metadata = {
  title: 'GestionoMisCuentas',
  description: 'Administra tus cuentas con facilidad.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#64B5F6" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <AccountProvider>
            <AppShell>
              {children}
            </AppShell>
          </AccountProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
