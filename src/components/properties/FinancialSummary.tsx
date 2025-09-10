
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { type Income, type ActualExpense, type Currency } from '@/lib/types';
import { ArrowDownCircle, ArrowUpCircle, MinusCircle } from 'lucide-react';

type FinancialSummaryProps = {
  incomes: Income[];
  expenses: ActualExpense[];
};

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

export function FinancialSummary({ incomes, expenses }: FinancialSummaryProps) {
  const summary = React.useMemo(() => {
    const totals: Record<Currency, { income: number; expense: number; net: number }> = {
      ARS: { income: 0, expense: 0, net: 0 },
      USD: { income: 0, expense: 0, net: 0 },
    };

    incomes.forEach(income => {
      totals[income.currency].income += income.amount;
    });

    expenses.forEach(expense => {
      totals[expense.currency].expense += expense.amount;
    });
    
    (Object.keys(totals) as Currency[]).forEach(currency => {
        totals[currency].net = totals[currency].income - totals[currency].expense;
    });

    return totals;
  }, [incomes, expenses]);

  const hasData = summary.ARS.income > 0 || summary.ARS.expense > 0 || summary.USD.income > 0 || summary.USD.expense > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen Financiero</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">No hay datos para el período seleccionado.</p>
        ) : (
          <div className="space-y-4">
            {(Object.keys(summary) as Currency[]).map(currency => {
              const data = summary[currency];
              if (data.income === 0 && data.expense === 0) return null;

              return (
                <div key={currency} className="space-y-3">
                  <h4 className="font-semibold text-lg">{currency}</h4>
                  <div className="flex items-center justify-between">
                    <div className='flex items-center gap-2'>
                        <ArrowUpCircle className="h-5 w-5 text-green-500" />
                        <span className="text-muted-foreground">Ingresos</span>
                    </div>
                    <span className="font-medium text-green-500">{formatCurrency(data.income, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className='flex items-center gap-2'>
                        <ArrowDownCircle className="h-5 w-5 text-red-500" />
                        <span className="text-muted-foreground">Egresos</span>
                    </div>
                    <span className="font-medium text-red-500">{formatCurrency(data.expense, currency)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className='flex items-center gap-2'>
                        <MinusCircle className={`h-5 w-5 ${data.net >= 0 ? 'text-primary' : 'text-destructive'}`} />
                        <span className="font-semibold">Saldo Neto</span>
                    </div>
                    <span className={`font-bold text-lg ${data.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(data.net, currency)}
                    </span>
                  </div>
                   {currency === 'ARS' && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
