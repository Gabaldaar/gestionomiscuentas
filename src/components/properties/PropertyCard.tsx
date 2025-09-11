
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Property, type Income, type ActualExpense, type Currency } from '@/lib/types';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

type MiniFinancialSummaryProps = {
  incomes: Income[];
  expenses: ActualExpense[];
};

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

function MiniFinancialSummary({ incomes, expenses }: MiniFinancialSummaryProps) {
    const summary = React.useMemo(() => {
        const totals: Record<Currency, { income: number; expense: number; net: number }> = {
        ARS: { income: 0, expense: 0, net: 0 },
        USD: { income: 0, expense: 0, net: 0 },
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
        
        (Object.keys(totals) as Currency[]).forEach(currency => {
            totals[currency].net = totals[currency].income - totals[currency].expense;
        });

        return totals;
    }, [incomes, expenses]);

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {(Object.keys(summary) as Currency[]).map(currency => {
                const data = summary[currency];
                return (
                    <div key={currency}>
                        <div className="font-bold mb-1">{currency}</div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                                <ArrowUp className="h-3 w-3" />
                                <span>{formatCurrency(data.income, currency)}</span>
                            </div>
                            <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                                <ArrowDown className="h-3 w-3" />
                                <span>{formatCurrency(data.expense, currency)}</span>
                            </div>
                            <div className={cn("flex justify-between items-center font-semibold", data.net >= 0 ? 'text-primary' : 'text-destructive')}>
                                <Minus className="h-3 w-3" />
                                <span>{formatCurrency(data.net, currency)}</span>
                            </div>
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
};

export function PropertyCard({ property, incomes, expenses }: PropertyCardProps) {
  return (
    <Link href={`/properties/${property.id}`} className="block transition-all hover:scale-[1.02]">
        <Card className="overflow-hidden h-full flex flex-row p-0">
            <div className="w-24 h-24 flex-shrink-0">
                <Image
                    src={property.imageUrl}
                    alt={property.name}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    data-ai-hint="apartment building"
                />
            </div>
            <div className="flex-grow flex flex-col">
                <CardHeader className="p-3 pb-2">
                    <CardTitle className="font-headline text-base">{property.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                   <MiniFinancialSummary incomes={incomes} expenses={expenses} />
                </CardContent>
            </div>
        </Card>
    </Link>
  );
}
