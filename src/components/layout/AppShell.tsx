
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/properties', label: 'Cuentas', icon: Building2 },
  { href: '/expenses', label: 'Panel de Gastos', icon: TrendingDown },
  { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
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
      return pathname === '/settings';
    }
    return pathname.startsWith(href);
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
            <h2 className="text-xl font-bold font-headline tracking-tight group-data-[collapsible=icon]:hidden">
              PropertyWise
            </h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
         <MainNav />
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
