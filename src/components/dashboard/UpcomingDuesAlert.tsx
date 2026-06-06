
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { type ExpectedExpense, type ActualExpense } from '@/lib/types';
import { addDays, startOfDay } from 'date-fns';
import { AlertTriangle, CalendarClock } from 'lucide-react';

type UpcomingDuesAlertProps = {
  allExpectedExpenses: ExpectedExpense[];
  allActualExpenses: ActualExpense[];
};

export function UpcomingDuesAlert({ allExpectedExpenses, allActualExpenses }: UpcomingDuesAlertProps) {
  
  const unpaidDues = React.useMemo(() => {
    return allExpectedExpenses.filter(expense => {
      if (expense.isPaid) return false;

      const paidAmount = allActualExpenses
        .filter(actual => {
          const actualDate = new Date(actual.date);
          const expectedDate = new Date(expense.date);
          return actual.propertyId === expense.propertyId &&
                 actual.subcategoryId === expense.subcategoryId &&
                 actualDate.getFullYear() === expectedDate.getFullYear() &&
                 actualDate.getMonth() === expectedDate.getMonth() &&
                 actual.currency === expense.currency;
        })
        .reduce((sum, current) => sum + current.amount, 0);

      return expense.amount > paidAmount;
    });
  }, [allExpectedExpenses, allActualExpenses]);
  

  const today = startOfDay(new Date());
  const nextWeek = addDays(today, 7);

  const overdueDues = unpaidDues.filter(due => new Date(due.date) < today);
  const upcomingDues = unpaidDues.filter(due => {
    const dueDate = new Date(due.date);
    return dueDate >= today && dueDate <= nextWeek;
  });

  if (overdueDues.length === 0 && upcomingDues.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {overdueDues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>¡Atención! Tienes {overdueDues.length} vencimiento(s) atrasado(s).</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            Algunos pagos programados no se han completado.
             <Button asChild variant="link" className='text-destructive'>
                <Link href="/due-dates?daysFilter=overdue">
                    Ver Vencidos
                </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {upcomingDues.length > 0 && (
         <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertTitle>Tienes {upcomingDues.length} vencimiento(s) en los próximos 7 días.</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            Prepárate para tus próximos pagos.
            <Button asChild variant="link">
                <Link href="/due-dates?daysFilter=7">
                    Ver Próximos
                </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
