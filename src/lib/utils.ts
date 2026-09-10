import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Wallet, type Currency } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortWallets(a: Wallet, b: Wallet) {
  // Group by currency first (ARS then USD)
  if (a.currency === 'ARS' && b.currency === 'USD') return -1;
  if (a.currency === 'USD' && b.currency === 'ARS') return 1;

  // Then sort alphabetically by name
  return a.name.localeCompare(b.name);
}

export function formatCurrency(
  amount: number | null | undefined, 
  currency?: string | null, 
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const safeCurrency: Currency = (currency === 'USD' || currency === 'ARS') ? currency : 'ARS';
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: safeCurrency,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits,
    }).format(safeAmount);
  } catch (e) {
    return `${safeCurrency === 'USD' ? 'US$' : '$'} ${safeAmount.toLocaleString('es-AR', { minimumFractionDigits: options?.minimumFractionDigits ?? 2 })}`;
  }
}
