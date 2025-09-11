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
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  Settings2,
  Home,
  Landmark,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/properties', label: 'Propiedades', icon: Building2 },
  { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
];

const settingsNavItems = [
    { href: '/settings/expenses', label: 'Categorías de Gastos', icon: Landmark },
    { href: '/settings/incomes', label: 'Categorías de Ingresos', icon: TrendingUp },
    { href: '/settings/wallets', label: 'Billeteras', icon: Wallet },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
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
                  isActive={pathname === item.href}
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
            <SidebarSeparator />
            <SidebarGroup>
                <SidebarGroupLabel>Configuración</SidebarGroupLabel>
                <SidebarMenu>
                 {settingsNavItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
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
            </SidebarGroup>
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
