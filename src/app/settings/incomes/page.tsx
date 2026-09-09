'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IncomeSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/categories/incomes');
  }, [router]);
  return null;
}
