
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  Settings2,
  Home,
  Wallet,
  TrendingDown,
  TrendingUp,
  PanelLeft,
  AreaChart,
  HandCoins
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Cuentas', icon: Building2 },
  { href: '/liabilities', label: 'Pasivos', icon: HandCoins },
  { href: '/expenses', label: 'Historial de Gastos', icon: TrendingDown },
  { href: '/incomes', label: 'Historial de Ingresos', icon: TrendingUp },
  { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
  { href: '/reports', label: 'Informes', icon: AreaChart },
  { href: '/settings/wallets', label: 'Billeteras', icon: Wallet },
  { href: '/settings', label: 'Configuración', icon: Settings2 },
];

function MainNav() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const checkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/settings') {
      return pathname.startsWith('/settings');
    }
    if (href.startsWith('/settings')) {
        return pathname.startsWith(href);
    }
    if (href !== '/') {
      return pathname.startsWith(href);
    }
    return false;
  };
  
    return (
     <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={checkActive(item.href)}
              tooltip={item.label}
              onClick={handleLinkClick}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render nothing on the server to avoid hydration mismatch
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
            <div className="w-full group-data-[collapsible=icon]:hidden">
                <Image
                  src={`/img/logo.png?t=${new Date().getTime()}`}
                  alt="GestionoMisCuentas Logo"
                  width={150}
                  height={40}
                  className="h-auto"
                />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
         <MainNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between p-4 border-b md:justify-end">
            <div className="flex items-center gap-2 md:hidden">
              <SidebarTrigger>
                <PanelLeft />
              </SidebarTrigger>
              <span className="font-semibold">Menú</span>
            </div>
             <div className="hidden md:flex">
              <SidebarTrigger>
                <PanelLeft />
              </SidebarTrigger>
            </div>
        </header>
        <main>{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
