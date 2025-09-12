
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  SidebarFooter,
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
  HandCoins,
  LogOut,
  User as UserIcon,
  Coins,
  LifeBuoy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/properties', label: 'Cuentas', icon: Building2 },
  { href: '/wallets', label: 'Billeteras', icon: Wallet },
  { href: '/assets', label: 'Activos', icon: Coins },
  { href: '/liabilities', label: 'Pasivos', icon: HandCoins },
  { href: '/expenses', label: 'Historial de Gastos', icon: TrendingDown },
  { href: '/incomes', label: 'Historial de Ingresos', icon: TrendingUp },
  { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
  { href: '/reports', label: 'Informes', icon: AreaChart },
  { href: '/categories', label: 'Categorías', icon: Settings2 },
  { href: '/help', label: 'Ayuda', icon: LifeBuoy },
];

function MainNav({ onLinkClick }: { onLinkClick: () => void }) {
  const pathname = usePathname();

  const checkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/categories') {
      return pathname.startsWith('/categories');
    }
    if (href.startsWith('/categories')) {
        return pathname.startsWith(href);
    }
    if (href !== '/') {
      return pathname.startsWith(href);
    }
    return false;
  };
  
    return (
     <SidebarMenu>
        {navItems.filter(item => item.href !== '/help').map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={checkActive(item.href)}
              tooltip={item.label}
              onClick={onLinkClick}
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

function UserProfile() {
    const { user } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await auth.signOut();
        router.push('/login');
    };

    if (!user) return null;

    const getInitials = (name: string | null) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-2 h-auto w-full justify-start group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'Usuario'} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <div className="group-data-[collapsible=icon]:hidden flex flex-col items-start">
                      <span className="text-sm font-medium truncate">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  if (loading || !user) {
    // AuthProvider shows a loader or handles redirection,
    // so we don't need to render the shell for unauthenticated users.
    return <>{children}</>;
  }
  
  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <div className="w-full group-data-[collapsible=icon]:hidden">
                <Image
                  src={`/img/logo.png`}
                  alt="GestionoMisCuentas Logo"
                  width={150}
                  height={40}
                  className="h-auto"
                />
            </div>
             <div className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center hidden">
                <Image
                  src={`/img/logo-sm.png`}
                  alt="Logo"
                  width={24}
                  height={24}
                />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
         <MainNav onLinkClick={handleLinkClick} />
        </SidebarContent>
         <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/help'} tooltip="Ayuda" onClick={handleLinkClick}>
                        <Link href="/help">
                            <LifeBuoy />
                            <span>Ayuda</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
            <UserProfile />
        </SidebarFooter>
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
