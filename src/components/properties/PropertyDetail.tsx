
'use client';

import * as React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, collection, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Loader } from 'lucide-react';
import { PropertyNotes } from '@/components/properties/PropertyNotes';
import { PropertyExpenses } from '@/components/properties/PropertyExpenses';
import { PropertyIncome } from '@/components/properties/PropertyIncome';
import { db } from '@/lib/firebase';
import { type Property, type ActualExpense, type Income, type ExpectedExpense, type Wallet, type ExpenseCategory, type IncomeCategory } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialSummary } from './FinancialSummary';
import { RecentActivity } from './RecentActivity';


export function PropertyDetail({ id }: { id: string }) {
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());

  const [actualExpenses, setActualExpenses] = React.useState<ActualExpense[]>([]);
  const [expectedExpenses, setExpectedExpenses] = React.useState<ExpectedExpense[]>([]);
  const [incomes, setIncomes] = React.useState<Income[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [expenseCategories, setExpenseCategories] = React.useState<ExpenseCategory[]>([]);
  const [incomeCategories, setIncomeCategories] = React.useState<IncomeCategory[]>([]);


  const fetchPageData = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
        // Property
        const docRef = doc(db, "properties", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        } else {
            setProperty(null); // Triggers notFound()
        }

        // --- Transactions ---
        const incomesCol = collection(db, 'properties', id, 'incomes');
        const incomesSnapshot = await getDocs(incomesCol);
        const incomesList = incomesSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate().toISOString(),
        })) as Income[];
        setIncomes(incomesList);
        
        const actualExpensesCol = collection(db, 'properties', id, 'actualExpenses');
        const actualExpensesSnapshot = await getDocs(actualExpensesCol);
        const actualExpensesList = actualExpensesSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate().toISOString(),
        })) as ActualExpense[];
        setActualExpenses(actualExpensesList);

        const expectedExpensesCol = collection(db, 'properties', id, 'expectedExpenses');
        const expectedExpensesSnapshot = await getDocs(expectedExpensesCol);
        const expectedExpensesList = expectedExpensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpectedExpense[];
        setExpectedExpenses(expectedExpensesList);
        
        // --- Global Data ---
        const walletsCol = collection(db, 'wallets');
        const walletsSnapshot = await getDocs(walletsCol);
        const walletsList = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
        setWallets(walletsList);

        const expenseCategoriesQuery = query(collection(db, 'expenseCategories'), orderBy('name'));
        const expenseCategoriesSnapshot = await getDocs(expenseCategoriesQuery);
        const expenseCategoriesList = await Promise.all(expenseCategoriesSnapshot.docs.map(async (categoryDoc) => {
            const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
            const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
            return {
            id: categoryDoc.id,
            name: categoryDoc.data().name,
            subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })),
            } as ExpenseCategory;
        }));
        setExpenseCategories(expenseCategoriesList);
        
        const incomeCategoriesQuery = query(collection(db, 'incomeCategories'), orderBy('name'));
        const incomeCategoriesSnapshot = await getDocs(incomeCategoriesQuery);
        const incomeCategoriesList = await Promise.all(incomeCategoriesSnapshot.docs.map(async (categoryDoc) => {
            const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
            const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
            return {
            id: categoryDoc.id,
            name: categoryDoc.data().name,
            subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })),
            } as IncomeCategory;
        }));
        setIncomeCategories(incomeCategoriesList);


    } catch (error) {
        console.error("Failed to fetch property data:", error);
        setProperty(null); // error state
    } finally {
        setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const filteredIncomes = React.useMemo(() => {
    return incomes.filter(income => {
        const incomeDate = new Date(income.date);
        const yearMatch = selectedYear === 'all' || incomeDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (incomeDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    });
  }, [incomes, selectedMonth, selectedYear]);

  const filteredActualExpenses = React.useMemo(() => {
    return actualExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const yearMatch = selectedYear === 'all' || expenseDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (expenseDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    });
  }, [actualExpenses, selectedMonth, selectedYear]);

  
  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    notFound();
  }
  
  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title={property.name}>
        <Button asChild>
          <Link href={`/properties/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar Cuenta
          </Link>
        </Button>
      </PageHeader>

       <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filtros Globales</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>


      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                 <CardContent className="p-0">
                     <Image
                        src={property.imageUrl}
                        alt={property.name}
                        width={800}
                        height={500}
                        className="w-full h-auto object-cover rounded-t-lg"
                        data-ai-hint="apartment building"
                    />
                </CardContent>
            </Card>

            <PropertyIncome
              propertyId={property.id}
              wallets={wallets}
              incomeCategories={incomeCategories}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              incomes={incomes}
              onTransactionUpdate={fetchPageData}
            />

            <PropertyExpenses
              propertyId={property.id}
              expenseCategories={expenseCategories}
              wallets={wallets}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              actualExpenses={actualExpenses}
              expectedExpenses={expectedExpenses}
              onTransactionUpdate={fetchPageData}
            />

            <PropertyNotes notes={property.notes} />
        </div>

        <div className="space-y-8">
          <FinancialSummary 
            incomes={filteredIncomes}
            expenses={filteredActualExpenses}
          />
          <RecentActivity 
             incomes={incomes}
             expenses={actualExpenses}
             expenseCategories={expenseCategories}
             incomeCategories={incomeCategories}
          />
        </div>
      </div>
    </div>
  );
}
