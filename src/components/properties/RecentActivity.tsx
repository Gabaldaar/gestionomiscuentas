
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { type Income, type ActualExpense, type ExpenseCategory, type IncomeCategory } from '@/lib/types';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type RecentActivityProps = {
  incomes: Income[];
  expenses: ActualExpense[];
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
};

type MergedActivity = (Income & { type: 'income' }) | (ActualExpense & { type: 'expense' });


export function RecentActivity({ incomes, expenses, expenseCategories, incomeCategories }: RecentActivityProps) {

  const getSubcategoryName = (id: string, type: 'income' | 'expense') => {
    const categories = type === 'income' ? incomeCategories : expenseCategories;
    for (const category of categories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return subcategory.name;
    }
    return 'Desconocido';
  }

  const mergedActivities = React.useMemo(() => {
    const combined: MergedActivity[] = [
      ...incomes.map(i => ({ ...i, type: 'income' as const })),
      ...expenses.map(e => ({ ...e, type: 'expense' as const })),
    ];
    return combined
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [incomes, expenses]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {mergedActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay actividad reciente para mostrar.</p>
        ) : (
          <div className="space-y-4">
            {mergedActivities.map(activity => (
              <div key={`${activity.type}-${activity.id}`} className="flex items-center">
                <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full mr-4",
                    activity.type === 'income' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                )}>
                  {activity.type === 'income' ? (
                    <ArrowUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-grow">
                    <p className="text-sm font-medium leading-none">
                        {getSubcategoryName(activity.subcategoryId, activity.type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.date), { addSuffix: true, locale: es })}
                    </p>
                </div>
                <div className={cn(
                    "font-medium",
                    activity.type === 'income' ? 'text-green-500' : 'text-red-500'
                )}>
                  {activity.type === 'expense' && '-'}
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: activity.currency }).format(activity.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
