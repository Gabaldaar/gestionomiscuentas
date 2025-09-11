
import * as React from 'react';
import { collectionGroup, getDocs, query, Timestamp, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Income, type ActualExpense, type IncomeCategory, type ExpenseCategory, type Currency, type Liability } from '@/lib/types';
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { MonthlyComparisonChart } from "@/components/dashboard/MonthlyComparisonChart";
import { RecentActivity } from '@/components/properties/RecentActivity';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

async function getDashboardData() {
  const incomesQuery = query(collectionGroup(db, 'incomes'));
  const expensesQuery = query(collectionGroup(db, 'actualExpenses'));
  const incomeCategoriesQuery = query(collection(db, 'incomeCategories'));
  const expenseCategoriesQuery = query(collection(db, 'expenseCategories'));
  const liabilitiesQuery = query(collection(db, 'liabilities'));

  const [
    incomesSnapshot,
    expensesSnapshot,
    incomeCategoriesSnapshot,
    expenseCategoriesSnapshot,
    liabilitiesSnapshot,
  ] = await Promise.all([
    getDocs(incomesQuery),
    getDocs(expensesQuery),
    getDocs(incomeCategoriesQuery),
    getDocs(expenseCategoriesQuery),
    getDocs(liabilitiesQuery),
  ]);

  const incomes = incomesSnapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
    date: (doc.data().date as Timestamp).toDate().toISOString(),
  } as Income));

  const expenses = expensesSnapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
    date: (doc.data().date as Timestamp).toDate().toISOString(),
  } as ActualExpense));

  const incomeCategories: IncomeCategory[] = await Promise.all(incomeCategoriesSnapshot.docs.map(async (categoryDoc) => {
      const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'));
      const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
      return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
  }));

  const expenseCategories: ExpenseCategory[] = await Promise.all(expenseCategoriesSnapshot.docs.map(async (categoryDoc) => {
      const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'));
      const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
      return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
  }));
  
  const liabilities = liabilitiesSnapshot.docs.map(doc => doc.data() as Liability);


  return { incomes, expenses, incomeCategories, expenseCategories, liabilities };
}


export default async function DashboardPage({ searchParams }: { searchParams: { month?: string, year?: string, currency?: string } }) {
  const { incomes, expenses, incomeCategories, expenseCategories, liabilities } = await getDashboardData();
  
  const currentMonth = searchParams.month ? parseInt(searchParams.month) : new Date().getMonth() + 1;
  const currentYear = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
  const selectedCurrency = (searchParams.currency as Currency | 'all') || 'all';

  const transactionsInPeriod = (transactions: (Income[] | ActualExpense[])) => {
    return transactions.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth;
    }) as (Income[] & ActualExpense[]);
  }

  const periodIncomes = transactionsInPeriod(incomes);
  const periodExpenses = transactionsInPeriod(expenses);

  const statsByCurrency = (Object.keys(periodIncomes.reduce((acc, curr) => ({...acc, [curr.currency]: true}), {})) as Currency[])
  .concat(Object.keys(periodExpenses.reduce((acc, curr) => ({...acc, [curr.currency]: true}), {})) as Currency[])
  .concat(Object.keys(liabilities.reduce((acc, curr) => ({...acc, [curr.currency]: true}), {})) as Currency[])
  .filter((value, index, self) => self.indexOf(value) === index)
  .map(currency => ({
      currency,
      incomes: periodIncomes.filter(i => i.currency === currency),
      expenses: periodExpenses.filter(e => e.currency === currency),
      liabilities: liabilities.filter(l => l.currency === currency),
  })).filter(item => selectedCurrency === 'all' || item.currency === selectedCurrency);


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Dashboard" />
      
      <DashboardFilters />

      <DashboardStats statsByCurrency={statsByCurrency} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ingresos vs. Egresos (Últimos 12 Meses)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <MonthlyComparisonChart incomes={incomes} expenses={expenses} currency={selectedCurrency} />
          </CardContent>
        </Card>
        <div className="col-span-4 md:col-span-3">
          <RecentActivity 
            incomes={incomes}
            expenses={expenses}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
          />
        </div>
      </div>
    </div>
  );
}
