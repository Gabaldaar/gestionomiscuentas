'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  ArrowLeftRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/wallets', label: 'Billeteras', icon: Wallet },
  { href: '/expenses', label: 'Gastos', icon: TrendingDown },
  { href: '/incomes', label: 'Ingresos', icon: TrendingUp },
  { href: '/transfers', label: 'Transf.', icon: ArrowLeftRight },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t h-16 flex items-center justify-around px-2 pb-safe">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
            isActive(item.href) 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <item.icon className={cn("h-5 w-5", isActive(item.href) && "stroke-[2.5px]")} />
          <span className="text-[10px] font-medium truncate w-full text-center">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
