"use client"

import * as React from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts"
import { type Income, type ActualExpense } from '@/lib/types';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

type MonthlyComparisonChartProps = {
  incomes: Income[];
  expenses: ActualExpense[];
  currency: string;
};

export function MonthlyComparisonChart({ incomes, expenses, currency }: MonthlyComparisonChartProps) {
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
        const date = new Date(inc.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        if (currency === 'all' || inc.currency === currency) {
            const targetMonth = last12Months.find(m => m.month === month && m.year === year);
            if (targetMonth) {
                targetMonth.income += inc.amount;
            }
        }
    });
    
    expenses.forEach(exp => {
        const date = new Date(exp.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        if (currency === 'all' || exp.currency === currency) {
            const targetMonth = last12Months.find(m => m.month === month && m.year === year);
            if (targetMonth) {
                targetMonth.expense += exp.amount;
            }
        }
    });

    return last12Months.reverse();
  }, [incomes, expenses, currency]);


  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
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
             formatter={(value: number) => new Intl.NumberFormat('es-AR').format(value)}
        />
        <Legend />
        <Bar dataKey="income" fill="hsl(var(--chart-1))" name="Ingresos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="hsl(var(--chart-2))" name="Egresos" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
