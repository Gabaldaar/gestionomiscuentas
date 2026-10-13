import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Wallet, type Currency } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortWallets(a: Wallet, b: Wallet) {
  // Group by currency first (ARS then USD)
  const currA = a.currency || 'ARS';
  const currB = b.currency || 'ARS';
  if (currA === 'ARS' && currB === 'USD') return -1;
  if (currA === 'USD' && currB === 'ARS') return 1;

  // Then sort alphabetically by name (handling undefined/null safely)
  const nameA = a.name || '';
  const nameB = b.name || '';
  return nameA.localeCompare(nameB);
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
