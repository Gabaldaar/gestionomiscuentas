
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  Settings2,
  Home,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/properties', label: 'Cuentas', icon: Building2 },
  { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
  { href: '/settings/wallets', label: 'Billeteras', icon: Wallet },
  { href: '/settings', label: 'Configuración', icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }
  
  const checkActive = (href: string) => {
    // Exact match for home page
    if (href === '/' && pathname === '/') {
        return true;
    }
    // For other routes, check if the pathname starts with the href,
    // but is not just the href for parent routes like /settings.
    if (href !== '/' && pathname.startsWith(href)) {
        if (pathname === href) {
            return true;
        }
        // Special case for /settings to avoid matching sub-routes
        if (href === '/settings' && pathname !== '/settings') {
            return false;
        }
        if (pathname.startsWith(`${href}/`)) {
            return true;
        }
    }
    return false;
  }


  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Button variant="ghost" size="icon" className="md:hidden">
              <Home />
            </Button>
            <h2 className="text-xl font-bold font-headline tracking-tight group-data-[collapsible=icon]:hidden">
              PropertyWise
            </h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={checkActive(item.href)}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b md:justify-end">
            <SidebarTrigger />
        </header>
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
