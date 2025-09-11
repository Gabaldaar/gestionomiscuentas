
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { type Property, type Income, type ActualExpense, type Currency } from '@/lib/types';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import * as React from 'react';

type MiniFinancialSummaryProps = {
  incomes: Income[];
  expenses: ActualExpense[];
};

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
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

    const hasData = summary.ARS.income > 0 || summary.ARS.expense > 0 || summary.USD.income > 0 || summary.USD.expense > 0;

    if (!hasData) {
        return <p className="text-sm text-muted-foreground mt-2">Sin movimientos este mes.</p>;
    }

    return (
        <div className="mt-4 space-y-2">
            {(Object.keys(summary) as Currency[]).map(currency => {
                const data = summary[currency];
                if (data.income === 0 && data.expense === 0) return null;

                return (
                    <div key={currency} className="text-sm">
                        <div className="font-bold text-base mb-1">{currency}</div>
                        <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                            <div className="flex items-center gap-1">
                                <ArrowUp className="h-4 w-4" />
                                <span>Ingresos</span>
                            </div>
                            <span>{formatCurrency(data.income, currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                             <div className="flex items-center gap-1">
                                <ArrowDown className="h-4 w-4" />
                                <span>Egresos</span>
                            </div>
                            <span>{formatCurrency(data.expense, currency)}</span>
                        </div>
                        <div className={`flex justify-between items-center font-semibold ${data.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            <div className="flex items-center gap-1">
                                <Minus className="h-4 w-4" />
                                <span>Neto</span>
                            </div>
                            <span>{formatCurrency(data.net, currency)}</span>
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
        <Card className="overflow-hidden h-full flex flex-row">
            <div className="w-1/3">
                <Image
                    src={property.imageUrl}
                    alt={property.name}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                    data-ai-hint="apartment building"
                />
            </div>
            <div className="w-2/3 flex flex-col">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">{property.name}</CardTitle>
                    <CardDescription className="line-clamp-2 h-[40px] pt-1">
                        Resumen del mes en curso
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                   <MiniFinancialSummary incomes={incomes} expenses={expenses} />
                </CardContent>
            </div>
        </Card>
    </Link>
  );
}


