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
  SidebarRail,
  SidebarMenuBadge,
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
  Menu,
  AreaChart,
  HandCoins,
  LogOut,
  User as UserIcon,
  Coins,
  LifeBuoy,
  CalendarClock,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../auth/AuthProvider';
import { auth, db } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AccountSelector } from '../shared/AccountSelector';
import { collection, collectionGroup, getDocs, query, Timestamp } from 'firebase/firestore';
import { type Wallet as WalletType, type ExpectedExpense, type ActualExpense } from '@/lib/types';
import { startOfDay } from 'date-fns';
import { QuickActions } from '../shared/QuickActions';
import { BottomNav } from './BottomNav';
import { useAccount } from '@/components/context/AccountProvider';

function MainNav({ onLinkClick, walletBadgeCount, duesBadgeCount }: { onLinkClick: () => void, walletBadgeCount: number, duesBadgeCount: number }) {
  const pathname = usePathname();
  const { activeAccountId } = useAccount();

  const checkActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/properties') {
      return pathname === '/properties' || pathname === '/properties/new';
    }
    if (href.startsWith('/properties/')) {
      return pathname.startsWith('/properties/') && pathname !== '/properties/new';
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

  const navItems = [
    { href: '/', label: 'Inicio', icon: LayoutDashboard },
    { 
      href: activeAccountId && activeAccountId !== 'all' ? `/properties/${activeAccountId}` : '/properties', 
      label: 'Presupuestos', 
      icon: Building2 
    },
    { href: '/due-dates', label: 'Vencimientos', icon: CalendarClock },
    { href: '/wallets', label: 'Billeteras', icon: Wallet },
    { href: '/assets', label: 'Activos', icon: Coins },
    { href: '/liabilities', label: 'Pasivos', icon: HandCoins },
    { href: '/expenses', label: 'Historial de Gastos', icon: TrendingDown },
    { href: '/incomes', label: 'Historial de Ingresos', icon: TrendingUp },
    { href: '/transfers', label: 'Transferencias', icon: ArrowLeftRight },
    { href: '/reports', label: 'Informes', icon: AreaChart },
    { href: '/categories', label: 'Categorías', icon: Settings2 },
    { href: '/properties', label: 'Config. Cuentas', icon: Settings },
  ];

  const navItemsWithBadges = navItems.map(item => {
    let badgeCount = 0;
    if (item.href === '/wallets') {
        badgeCount = walletBadgeCount;
    }
    if (item.href === '/due-dates') {
        badgeCount = duesBadgeCount;
    }
    return { ...item, badgeCount };
  });
  
    return (
     <SidebarMenu>
        {navItemsWithBadges.map((item) => (
          <SidebarMenuItem key={item.label + item.href}>
            <SidebarMenuButton
              asChild
              isActive={checkActive(item.href)}
              tooltip={item.label}
              onClick={onLinkClick}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
                {item.badgeCount > 0 && <SidebarMenuBadge>{item.badgeCount}</SidebarMenuBadge>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    )
}

function UserProfile({ onLinkClick }: { onLinkClick: () => void }) {
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
                    <div className="group-data-[collapsible=icon]:hidden flex flex-col items-start text-left">
                      <span className="text-sm font-medium truncate max-w-[120px]">{user.displayName}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
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

function AppShellContent({ children }: { children: React.ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const { user } = useAuth();

  const [walletBadgeCount, setWalletBadgeCount] = React.useState(0);
  const [duesBadgeCount, setDuesBadgeCount] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;

    async function fetchNotificationData() {
        try {
            const [walletsSnap, expectedExpensesSnap, actualExpensesSnap] = await Promise.all([
                getDocs(query(collection(db, 'wallets'))),
                getDocs(query(collectionGroup(db, 'expectedExpenses'))),
                getDocs(query(collectionGroup(db, 'actualExpenses'))),
            ]);

            const wallets = walletsSnap.docs.map(doc => doc.data() as WalletType);
            const negativeBalanceCount = wallets.filter(w => w.balance < 0).length;
            setWalletBadgeCount(negativeBalanceCount);

            const allExpectedExpenses = expectedExpensesSnap.docs.map(doc => {
                const data = doc.data();
                let expenseDate: Date;
                if (data.date instanceof Timestamp) {
                    expenseDate = data.date.toDate();
                } else if (typeof data.date === 'string') {
                    expenseDate = new Date(data.date);
                } else {
                    const year = (data as any).year || new Date().getFullYear();
                    const month = (data as any).month ? (data as any).month - 1 : new Date().getMonth();
                    expenseDate = new Date(year, month, 5);
                }
                return {
                    ...data,
                    id: doc.id,
                    date: expenseDate,
                    propertyId: doc.ref.parent.parent?.id
                } as ExpectedExpense & { date: Date, propertyId: string };
            });

            const allActualExpenses = actualExpensesSnap.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    id: doc.id,
                    date: (data.date as Timestamp).toDate(),
                    propertyId: doc.ref.parent.parent?.id
                } as ActualExpense & { date: Date, propertyId: string };
            });

            const unpaidDues = allExpectedExpenses.filter(expense => {
                if (expense.isPaid) return false;
                const paidAmount = allActualExpenses
                    .filter(actual => {
                        const actualDate = actual.date;
                        const expectedDate = expense.date;
                        return actual.propertyId === expense.propertyId &&
                               actual.subcategoryId === expense.subcategoryId &&
                               actualDate.getFullYear() === expectedDate.getFullYear() &&
                               actualDate.getMonth() === expectedDate.getMonth() &&
                               actual.currency === expense.currency;
                    })
                    .reduce((sum, current) => sum + current.amount, 0);
                return expense.amount > paidAmount;
            });

            const today = startOfDay(new Date());
            const overdueDuesCount = unpaidDues.filter(due => due.date < today).length;
            setDuesBadgeCount(overdueDuesCount);

        } catch (error) {
            console.error("Error fetching notification data:", error);
            setWalletBadgeCount(0);
            setDuesBadgeCount(0);
        }
    }

    fetchNotificationData();
  }, [user, pathname]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <Sidebar collapsible="icon">
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
         <MainNav onLinkClick={handleLinkClick} walletBadgeCount={walletBadgeCount} duesBadgeCount={duesBadgeCount} />
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
            <UserProfile onLinkClick={handleLinkClick} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="relative">
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger>
                <Menu />
              </SidebarTrigger>
              <div className='hidden md:block'>
                <AccountSelector />
              </div>
              <span className="font-semibold md:hidden">Menú</span>
            </div>
             <div className="md:hidden">
              <AccountSelector />
            </div>
        </header>
        <main className="pb-20 md:pb-0">{children}</main>
        <QuickActions />
        <BottomNav />
      </SidebarInset>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading || !user) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppShellContent>{children}</AppShellContent>
    </SidebarProvider>
  );
}
