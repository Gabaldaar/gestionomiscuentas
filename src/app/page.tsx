
'use client';

import * as React from 'react';
import { collectionGroup, getDocs, query, Timestamp, collection, addDoc, writeBatch, getDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Income, type ActualExpense, type IncomeCategory, type ExpenseCategory, type Currency, type Liability, type Asset, type Property, ExpectedExpense, type IncomeSubcategory, type ExpenseSubcategory } from '@/lib/types';
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { MonthlyComparisonChart } from "@/components/dashboard/MonthlyComparisonChart";
import { RecentActivity } from '@/components/properties/RecentActivity';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { Suspense } from 'react';
import { Loader, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchParams, useRouter } from 'next/navigation';
import { UpcomingDuesAlert } from '@/components/dashboard/UpcomingDuesAlert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AddExpenseDialog } from '@/components/properties/AddExpenseDialog';
import { AddIncomeDialog } from '@/components/properties/AddIncomeDialog';
import { useToast } from '@/hooks/use-toast';
import { type Wallet } from '@/lib/types';
import { useAccount } from '@/components/context/AccountProvider';

type DashboardData = {
  incomes: Income[];
  expenses: ActualExpense[];
  incomeCategories: IncomeCategory[];
  expenseCategories: ExpenseCategory[];
  liabilities: Liability[];
  assets: Asset[];
  properties: Property[];
  expectedExpenses: ExpectedExpense[];
  wallets: Wallet[];
};

// Main dashboard content component
function DashboardContent() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { activeAccountId } = useAccount();

  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = React.useState(false);
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchPageData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const incomesQuery = query(collectionGroup(db, 'incomes'));
      const expensesQuery = query(collectionGroup(db, 'actualExpenses'));
      const expectedExpensesQuery = query(collectionGroup(db, 'expectedExpenses'));
      const incomeCategoriesQuery = query(collection(db, 'incomeCategories'), orderBy('name'));
      const expenseCategoriesQuery = query(collection(db, 'expenseCategories'), orderBy('name'));
      const liabilitiesQuery = query(collection(db, 'liabilities'));
      const assetsQuery = query(collection(db, 'assets'));
      const propertiesQuery = query(collection(db, 'properties'));
      const walletsQuery = query(collection(db, 'wallets'));

      const [
        incomesSnapshot,
        expensesSnapshot,
        expectedExpensesSnapshot,
        incomeCategoriesSnapshot,
        expenseCategoriesSnapshot,
        liabilitiesSnapshot,
        assetsSnapshot,
        propertiesSnapshot,
        walletsSnapshot,
      ] = await Promise.all([
        getDocs(incomesQuery),
        getDocs(expensesQuery),
        getDocs(expectedExpensesQuery),
        getDocs(incomeCategoriesQuery),
        getDocs(expenseCategoriesQuery),
        getDocs(liabilitiesQuery),
        getDocs(assetsQuery),
        getDocs(propertiesQuery),
        getDocs(walletsQuery),
      ]);

      const incomes = incomesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: (doc.data().date as Timestamp).toDate().toISOString(),
        propertyId: doc.ref.parent.parent?.id,
      } as Income));

      const expenses = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: (doc.data().date as Timestamp).toDate().toISOString(),
        propertyId: doc.ref.parent.parent?.id,
      } as ActualExpense));
      
      const expectedExpenses = expectedExpensesSnapshot.docs.map(doc => {
          const data = doc.data();
          let date;
          if (data.date instanceof Timestamp) {
            date = data.date.toDate().toISOString();
          } else if (typeof data.date === 'string') {
            date = data.date;
          } else {
            // Fallback for old month/year format
            date = new Date((data as any).year, (data as any).month - 1, 5).toISOString();
          }
           return {
            id: doc.id,
            ...data,
            date,
            propertyId: doc.ref.parent.parent?.id,
          } as ExpectedExpense;
      });

      const incomeCategories: IncomeCategory[] = await Promise.all(incomeCategoriesSnapshot.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as IncomeSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as IncomeCategory;
      }));

      const expenseCategories: ExpenseCategory[] = await Promise.all(expenseCategoriesSnapshot.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as ExpenseSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as ExpenseCategory;
      }));

      const liabilities = liabilitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Liability));
      const assets = assetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Asset));
      const properties = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      const wallets = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));

      const dashboardData = { incomes, expenses, incomeCategories, expenseCategories, liabilities, assets, properties, expectedExpenses, wallets };
      setData(dashboardData);
      
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los datos del dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);


  const handleExpenseSubmit = async (data: any) => {
    if (!data.propertyId) {
        toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el gasto.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        const expenseRef = doc(collection(db, 'properties', data.propertyId, 'actualExpenses'));
        const walletRef = doc(db, 'wallets', data.walletId);
        
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
        
        const walletData = walletSnap.data() as any;
        if (walletData.balance < data.amount && !walletData.allowNegativeBalance) {
             throw new Error(`Fondos insuficientes en ${walletData.name}.`);
        }
        batch.update(walletRef, { balance: walletData.balance - data.amount });
        batch.set(expenseRef, { ...data, date: Timestamp.fromDate(data.date) });

        await batch.commit();
        toast({ title: "Gasto añadido exitosamente" });
        fetchPageData();
        setIsExpenseDialogOpen(false);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo registrar el gasto.";
        toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleIncomeSubmit = async (data: any) => {
    if (!data.propertyId) {
        toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el ingreso.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        const incomeRef = doc(collection(db, 'properties', data.propertyId, 'incomes'));
        const walletRef = doc(db, 'wallets', data.walletId);
        
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
        
        const walletData = walletSnap.data() as any;
        batch.update(walletRef, { balance: walletData.balance + data.amount });
        batch.set(incomeRef, { ...data, date: Timestamp.fromDate(data.date) });
        
        await batch.commit();
        toast({ title: "Ingreso añadido exitosamente" });
        fetchPageData();
        setIsIncomeDialogOpen(false);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo registrar el ingreso.";
        toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Inicio" />
        <Card>
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent><p>{error || "No se pudieron cargar los datos."}</p></CardContent>
        </Card>
      </div>
    );
  }

  const { incomes, expenses, incomeCategories, expenseCategories, liabilities, assets, properties, expectedExpenses, wallets } = data;

  const currentMonth = searchParams?.get('month') ? parseInt(searchParams.get('month') as string) : new Date().getMonth() + 1;
  const currentYear = searchParams?.get('year') ? parseInt(searchParams.get('year') as string) : new Date().getFullYear();
  const selectedCurrency = (searchParams?.get('currency') as Currency | 'all') || 'all';
  
  const selectedProperties = activeAccountId === 'all' ? properties.map(p => p.id) : [activeAccountId];
  
  const filteredIncomes = incomes.filter(income => selectedProperties.includes(income.propertyId));
  const filteredExpenses = expenses.filter(expense => selectedProperties.includes(expense.propertyId));
  const filteredExpectedExpenses = expectedExpenses.filter(expense => selectedProperties.includes(expense.propertyId));


  const periodIncomes = transactionsInPeriod(filteredIncomes);
  const periodExpenses = transactionsInPeriod(filteredExpenses);

  const statsByCurrency = (Object.keys(periodIncomes.reduce((acc, curr) => ({ ...acc, [curr.currency]: true }), {})) as Currency[])
    .concat(Object.keys(periodExpenses.reduce((acc, curr) => ({ ...acc, [curr.currency]: true }), {})) as Currency[])
    .concat(Object.keys(liabilities.reduce((acc, curr) => ({ ...acc, [curr.currency]: true }), {})) as Currency[])
    .concat(Object.keys(assets.reduce((acc, curr) => ({ ...acc, [curr.currency]: true }), {})) as Currency[])
    .filter((value, index, self) => self.indexOf(value) === index)
    .map(currency => ({
      currency,
      incomes: periodIncomes.filter(i => i.currency === currency),
      expenses: periodExpenses.filter(e => e.currency === currency),
      liabilities: liabilities.filter(l => l.currency === currency),
      assets: assets.filter(a => a.currency === currency),
    })).filter(item => selectedCurrency === 'all' || item.currency === selectedCurrency);

  function transactionsInPeriod(transactions: (Income[] | ActualExpense[])) {
    return transactions.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth;
    }) as (Income[] & ActualExpense[]);
  };
  
  const expenseDialogInitialData = activeAccountId !== 'all' ? { propertyId: activeAccountId } : {};
  const incomeDialogInitialData = activeAccountId !== 'all' ? { propertyId: activeAccountId } : {};

  return (
    <>
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Inicio" />
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Button onClick={() => setIsExpenseDialogOpen(true)}>
          <span className='text-lg'>+</span>
          Gasto
        </Button>
        <Button onClick={() => setIsIncomeDialogOpen(true)}>
          <span className='text-lg'>+</span>
          Ingreso
        </Button>
        <Button asChild>
          <Link href="/transfers/new">
            + Transf.
          </Link>
        </Button>
      </div>

      <DashboardFilters />
      <UpcomingDuesAlert allExpectedExpenses={filteredExpectedExpenses} allActualExpenses={filteredExpenses} />
      <DashboardStats statsByCurrency={statsByCurrency} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Ingresos vs. Egresos (Últimos 12 Meses)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <MonthlyComparisonChart incomes={filteredIncomes} expenses={filteredExpenses} currency={selectedCurrency} />
          </CardContent>
        </Card>
        <div className="col-span-4 md:col-span-3">
          <RecentActivity
            incomes={filteredIncomes}
            expenses={filteredExpenses}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
          />
        </div>
      </div>
    </div>
    <AddExpenseDialog
        isOpen={isExpenseDialogOpen}
        onOpenChange={setIsExpenseDialogOpen}
        onExpenseSubmit={handleExpenseSubmit}
        isSubmitting={isSubmitting}
        expenseCategories={expenseCategories}
        wallets={wallets}
        properties={activeAccountId === 'all' ? properties : properties.filter(p => p.id === activeAccountId)}
        liabilities={liabilities}
        initialData={expenseDialogInitialData}
        title="Añadir Gasto Rápido"
        description="Registra un nuevo gasto desde el panel de inicio."
    />
    <AddIncomeDialog
        isOpen={isIncomeDialogOpen}
        onOpenChange={setIsIncomeDialogOpen}
        onIncomeSubmit={handleIncomeSubmit}
        isSubmitting={isSubmitting}
        incomeCategories={incomeCategories}
        wallets={wallets}
        properties={activeAccountId === 'all' ? properties : properties.filter(p => p.id === activeAccountId)}
        initialData={incomeDialogInitialData}
        title="Añadir Ingreso Rápido"
        description="Registra un nuevo ingreso desde el panel de inicio."
    />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
