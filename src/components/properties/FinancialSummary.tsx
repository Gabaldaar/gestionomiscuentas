
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type Income, type ActualExpense, type Currency } from '@/lib/types';
import { ArrowDownCircle, ArrowUpCircle, MinusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          <TooltipProvider>
          <div className="space-y-4">
            {(Object.keys(summary) as Currency[]).map(currency => {
              const data = summary[currency];
              if (data.income === 0 && data.expense === 0) return null;

              const netBalanceColor = data.net < 0 
                ? 'text-destructive' 
                : currency === 'USD' 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-blue-600 dark:text-blue-400';

              return (
                <div key={currency} className="space-y-3">
                  <h4 className="font-semibold text-lg">{currency}</h4>
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='flex items-center gap-2 cursor-help'>
                            <ArrowUpCircle className="h-5 w-5 text-green-500" />
                            <span className="text-muted-foreground underline decoration-dotted underline-offset-2">Ingresos</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>El total de ingresos recibidos en este período.</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={cn("font-medium", {
                        'text-green-600 dark:text-green-400': currency === 'USD',
                        'text-blue-600 dark:text-blue-400': currency === 'ARS',
                    })}>{formatCurrency(data.income, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='flex items-center gap-2 cursor-help'>
                            <ArrowDownCircle className="h-5 w-5 text-red-500" />
                            <span className="text-muted-foreground underline decoration-dotted underline-offset-2">Egresos</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>El total de gastos realmente efectuados en este período.</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="font-medium text-red-500">{formatCurrency(data.expense, currency)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className='flex items-center gap-2 cursor-help'>
                            <MinusCircle className={cn('h-5 w-5', netBalanceColor)} />
                            <span className="font-semibold underline decoration-dotted underline-offset-2">Saldo Neto</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>La diferencia entre ingresos y egresos en este período.</p>
                      </TooltipContent>
                    </Tooltip>
                    <span className={cn('font-bold text-lg', netBalanceColor)}>
                        {formatCurrency(data.net, currency)}
                    </span>
                  </div>
                   {currency === 'ARS' && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
