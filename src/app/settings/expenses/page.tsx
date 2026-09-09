'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExpenseSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/categories/expenses');
  }, [router]);
  return null;
}
