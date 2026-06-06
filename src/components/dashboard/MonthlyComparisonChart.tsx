
"use client"

import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts"
import { type Income, type ActualExpense, type Currency } from '@/lib/types';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

type MonthlyComparisonChartProps = {
  incomes: Income[];
  expenses: ActualExpense[];
  currency: Currency | 'all';
};

type SingleCurrencyChartProps = {
    incomes: Income[];
    expenses: ActualExpense[];
    currency: Currency;
}

const SingleCurrencyChart = ({ incomes, expenses, currency }: SingleCurrencyChartProps) => {
    const data = React.useMemo(() => {
        const last12Months: { name: string, month: number, year: number, income: number, expense: number }[] = [];
        let currentDate = new Date();

        for (let i = 0; i < 12; i++) {
            const date = subMonths(currentDate, i);
            last12Months.push({
                name: format(date, 'MMM', { locale: es }),
                month: date.getMonth() + 1,
                year: date.getFullYear(),
                income: 0,
                expense: 0,
            });
        }

        incomes.forEach(inc => {
            if (inc.currency === currency) {
                const date = new Date(inc.date);
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                const targetMonth = last12Months.find(m => m.month === month && m.year === year);
                if (targetMonth) {
                    targetMonth.income += inc.amount;
                }
            }
        });
        
        expenses.forEach(exp => {
            if (exp.currency === currency) {
                const date = new Date(exp.date);
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                const targetMonth = last12Months.find(m => m.month === month && m.year === year);
                if (targetMonth) {
                    targetMonth.expense += exp.amount;
                }
            }
        });

        return last12Months.reverse();
    }, [incomes, expenses, currency]);

    const hasData = data.some(d => d.income > 0 || d.expense > 0);

    if (!hasData) {
        return (
             <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed bg-muted/50 p-4">
                <p className="text-center text-sm text-muted-foreground">No hay datos de {currency} para mostrar en el gráfico.</p>
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
                dataKey="name"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
            />
            <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value/1000}k`}
            />
            <Tooltip
                contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))'
                }}
                formatter={(value: number) => new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: currency,
                    notation: 'compact',
                }).format(value)}
            />
            <Legend wrapperStyle={{fontSize: "0.8rem"}}/>
            <Bar dataKey="income" fill="hsl(var(--chart-1))" name="Ingresos" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="hsl(var(--chart-2))" name="Egresos" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
};


export function MonthlyComparisonChart({ incomes, expenses, currency }: MonthlyComparisonChartProps) {
  
  if (currency === 'all') {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[350px]">
            <div className='flex flex-col gap-2'>
                <h3 className="font-semibold text-center text-muted-foreground">Resumen en ARS</h3>
                <SingleCurrencyChart incomes={incomes} expenses={expenses} currency='ARS' />
            </div>
             <div className='flex flex-col gap-2'>
                <h3 className="font-semibold text-center text-muted-foreground">Resumen en USD</h3>
                <SingleCurrencyChart incomes={incomes} expenses={expenses} currency='USD' />
            </div>
        </div>
    )
  }

  return <SingleCurrencyChart incomes={incomes} expenses={expenses} currency={currency} />
}
