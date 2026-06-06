import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { type Wallet } from "./types";

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
