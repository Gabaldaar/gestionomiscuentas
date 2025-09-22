
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Property, type Income, type ActualExpense, type ExpectedExpense, type Currency } from '@/lib/types';
import { ArrowUp, ArrowDown, Minus, CircleAlert } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

type MiniFinancialSummaryProps = {
  incomes: Income[];
  expenses: ActualExpense[];
  expectedExpenses: ExpectedExpense[];
};

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

function MiniFinancialSummary({ incomes, expenses, expectedExpenses }: MiniFinancialSummaryProps) {
    const summary = React.useMemo(() => {
        const totals: Record<Currency, { income: number; expense: number; net: number; expectedExpense: number; expenseBalance: number }> = {
            ARS: { income: 0, expense: 0, net: 0, expectedExpense: 0, expenseBalance: 0 },
            USD: { income: 0, expense: 0, net: 0, expectedExpense: 0, expenseBalance: 0 },
        };

        incomes.forEach(income => {
            if (totals[income.currency]) {
                totals[income.currency].income += income.amount;
            }
        });

        expenses.forEach(expense => {
            if (totals[expense.currency]) {
                totals[expense.currency].expense += expense.amount;
            }
        });
        
        expectedExpenses.forEach(exp => {
            if (totals[exp.currency]) {
                totals[exp.currency].expectedExpense += exp.amount;
            }
        });

        (Object.keys(totals) as Currency[]).forEach(currency => {
            totals[currency].net = totals[currency].income - totals[currency].expense;
            totals[currency].expenseBalance = totals[currency].expectedExpense - totals[currency].expense;
        });

        return totals;
    }, [incomes, expenses, expectedExpenses]);
    
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs flex-grow">
            {(Object.keys(summary) as Currency[]).map(currency => {
                const data = summary[currency];
                if (data.income === 0 && data.expense === 0 && data.expectedExpense === 0) return (
                  <div key={currency}>
                    <div className="font-bold mb-1">{currency}</div>
                     <div className="text-muted-foreground">Sin datos</div>
                  </div>
                );
                return (
                    <div key={currency}>
                        <div className="font-bold mb-1">{currency}</div>
                        <div className="space-y-1">
                            <div className={cn("flex justify-between items-center", {
                                'text-green-600 dark:text-green-400': currency === 'USD',
                                'text-blue-600 dark:text-blue-400': currency === 'ARS',
                            })}>
                                <ArrowUp className="h-3 w-3" />
                                <span>{formatCurrency(data.income, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-500">
                                <ArrowDown className="h-3 w-3" />
                                <span>{formatCurrency(data.expense, currency)}</span>
                            </div>
                            <div className={cn("flex justify-between items-center font-semibold", {
                                'text-destructive': data.net < 0,
                                'text-green-600 dark:text-green-400': data.net >= 0 && currency === 'USD',
                                'text-blue-600 dark:text-blue-400': data.net >= 0 && currency === 'ARS',
                            })}>
                                <Minus className="h-3 w-3" />
                                <span>{formatCurrency(data.net, currency)}</span>
                            </div>
                             {data.expenseBalance > 0 && (
                                <div className="flex justify-between items-center text-orange-500 font-semibold">
                                    <CircleAlert className="h-3 w-3" />
                                    <span>{formatCurrency(data.expenseBalance, currency)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
}


type PropertyCardProps = {
  property: Property;
  incomes: Income[];
  expenses: ActualExpense[];
  expectedExpenses: ExpectedExpense[];
};

export function PropertyCard({ property, incomes, expenses, expectedExpenses }: PropertyCardProps) {
  return (
    <Link href={`/properties/${property.id}`} className="block transition-all hover:scale-[1.02]">
        <Card className="overflow-hidden h-full flex flex-col p-0">
            <CardHeader className="p-4 pb-2">
                <CardTitle className="font-headline text-lg">{property.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col sm:flex-row items-start gap-4">
                <div className="w-24 h-24 flex-shrink-0">
                    <Image
                        src={property.imageUrl}
                        alt={property.name}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover rounded-md"
                        data-ai-hint="apartment building"
                    />
                </div>
                <MiniFinancialSummary incomes={incomes} expenses={expenses} expectedExpenses={expectedExpenses}/>
            </CardContent>
        </Card>
    </Link>
  );
}
