
'use client';

import * as React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, collection, getDocs, Timestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Loader } from 'lucide-react';
import { PropertyExpenses } from '@/components/properties/PropertyExpenses';
import { PropertyIncome } from '@/components/properties/PropertyIncome';
import { db } from '@/lib/firebase';
import { type Property, type ActualExpense, type Income, type ExpectedExpense, type Wallet, type ExpenseCategory, type IncomeCategory } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialSummary } from './FinancialSummary';
import { RecentActivity } from './RecentActivity';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';


export function PropertyDetail({ id }: { id: string }) {
  const { toast } = useToast();
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSavingNotes, setIsSavingNotes] = React.useState(false);
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
  
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (property) {
        setProperty({...property, notes: e.target.value});
    }
  };

  const handleSaveNotes = async () => {
    if (!property) return;
    setIsSavingNotes(true);
    try {
        const propertyRef = doc(db, 'properties', id);
        await updateDoc(propertyRef, { notes: property.notes });
        toast({ title: "Notas guardadas", description: "Las notas de la cuenta han sido actualizadas." });
    } catch (error) {
        console.error("Error saving notes:", error);
        toast({ title: "Error", description: "No se pudieron guardar las notas.", variant: "destructive" });
    } finally {
        setIsSavingNotes(false);
    }
  };


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
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <CardTitle className="text-lg">Filtros Globales</CardTitle>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full md:w-[120px]">
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


      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Detalles de la Cuenta</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                        <Image
                            src={property.imageUrl}
                            alt={property.name}
                            width={250}
                            height={250}
                            className="w-full h-auto object-cover rounded-lg aspect-square"
                            data-ai-hint="apartment building"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div>
                            <h3 className="font-semibold text-lg">Descripción</h3>
                            <p className="text-muted-foreground">{property.description}</p>
                        </div>
                         <div>
                            <h3 className="font-semibold text-lg">Notas</h3>
                            <Textarea 
                                value={property.notes}
                                onChange={handleNotesChange}
                                rows={5}
                            />
                            <Button onClick={handleSaveNotes} disabled={isSavingNotes} size="sm" className="mt-2">
                                {isSavingNotes && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Notas
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className='lg:hidden space-y-8'>
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

        </div>

        <div className="hidden lg:block space-y-8">
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
