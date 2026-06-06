'use client';

import * as React from 'react';
import { Plus, TrendingDown, TrendingUp, ArrowLeftRight, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useAccount } from '@/components/context/AccountProvider';
import { collection, getDocs, query, orderBy, Timestamp, writeBatch, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { AddExpenseDialog } from '@/components/properties/AddExpenseDialog';
import { AddIncomeDialog } from '@/components/properties/AddIncomeDialog';
import { type ExpenseCategory, type IncomeCategory, type Wallet, type Property, type Liability, type ExpenseSubcategory, type IncomeSubcategory } from '@/lib/types';

export function QuickActions() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeAccountId } = useAccount();

  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);
  const [isIncomeOpen, setIsIncomeOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [data, setData] = React.useState<{
    expenseCategories: ExpenseCategory[];
    incomeCategories: IncomeCategory[];
    wallets: Wallet[];
    properties: Property[];
    liabilities: Liability[];
  } | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [
        expenseCatsSnap,
        incomeCatsSnap,
        walletsSnap,
        propertiesSnap,
        liabilitiesSnap
      ] = await Promise.all([
        getDocs(query(collection(db, 'expenseCategories'), orderBy('name'))),
        getDocs(query(collection(db, 'incomeCategories'), orderBy('name'))),
        getDocs(query(collection(db, 'wallets'), orderBy('name'))),
        getDocs(query(collection(db, 'properties'), orderBy('name'))),
        getDocs(query(collection(db, 'liabilities'), orderBy('name'))),
      ]);

      const expenseCategories = await Promise.all(expenseCatsSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as ExpenseSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as ExpenseCategory;
      }));

      const incomeCategories = await Promise.all(incomeCatsSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as IncomeSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as IncomeCategory;
      }));

      setData({
        expenseCategories,
        incomeCategories,
        wallets: walletsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)),
        properties: propertiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property)),
        liabilities: liabilitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Liability)),
      });
    } catch (error) {
      console.error("Error fetching quick action data:", error);
    }
  }, []);

  // Cargar datos al montar el componente para que los diálogos respondan rápido
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExpenseSubmit = async (formData: any) => {
    if (!formData.propertyId) {
      toast({ title: "Error", description: "Debes seleccionar una cuenta.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const expenseRef = doc(collection(db, 'properties', formData.propertyId, 'actualExpenses'));
      const walletRef = doc(db, 'wallets', formData.walletId);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
      const walletData = walletSnap.data() as Wallet;
      if (walletData.balance < formData.amount && !walletData.allowNegativeBalance) {
        throw new Error(`Fondos insuficientes en ${walletData.name}.`);
      }
      batch.update(walletRef, { balance: walletData.balance - formData.amount });
      
      const expenseData = { ...formData, date: Timestamp.fromDate(formData.date) };
      if (expenseData.liabilityId === 'none' || !expenseData.liabilityId) {
          delete expenseData.liabilityId;
      }
      batch.set(expenseRef, expenseData);

      if (expenseData.liabilityId) {
          const liabilityRef = doc(db, 'liabilities', expenseData.liabilityId);
          const liabilitySnap = await getDoc(liabilityRef);
          if (liabilitySnap.exists()) {
              const liabilityData = liabilitySnap.data() as Liability;
              batch.update(liabilityRef, { outstandingBalance: liabilityData.outstandingBalance - expenseData.amount });

              const paymentRef = doc(collection(db, 'liabilities', expenseData.liabilityId, 'payments'));
              const paymentData = {
                  liabilityId: expenseData.liabilityId,
                  date: Timestamp.fromDate(expenseData.date),
                  amount: expenseData.amount,
                  walletId: expenseData.walletId,
                  currency: expenseData.currency,
                  notes: `Pago registrado desde Acción Rápida`,
                  actualExpenseId: expenseRef.id,
                  propertyId: expenseData.propertyId,
              };
              batch.set(paymentRef, paymentData);
          }
      }

      await batch.commit();
      toast({ title: "Gasto añadido exitosamente" });
      setIsExpenseOpen(false);
      // Refrescamos para que las listas en la página actual se actualicen si es necesario
      router.refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo registrar el gasto.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIncomeSubmit = async (formData: any) => {
    if (!formData.propertyId) {
      toast({ title: "Error", description: "Debes seleccionar una cuenta.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      const incomeRef = doc(collection(db, 'properties', formData.propertyId, 'incomes'));
      const walletRef = doc(db, 'wallets', formData.walletId);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
      const walletData = walletSnap.data() as Wallet;
      batch.update(walletRef, { balance: walletData.balance + formData.amount });

      const incomeData = { ...formData, date: Timestamp.fromDate(formData.date) };
      if (incomeData.assetId === 'none' || !incomeData.assetId) {
          delete incomeData.assetId;
      }
      batch.set(incomeRef, incomeData);

      await batch.commit();
      toast({ title: "Ingreso añadido exitosamente" });
      setIsIncomeOpen(false);
      router.refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "No se pudo registrar el ingreso.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) return null;

  const relevantProperties = activeAccountId === 'all' ? data.properties : data.properties.filter(p => p.id === activeAccountId);
  const initialData = activeAccountId !== 'all' ? { propertyId: activeAccountId } : {};

  return (
    <>
      <div className="fixed bottom-20 md:bottom-10 right-6 md:right-10 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform bg-primary text-primary-foreground border-4 border-background">
              <Plus className="h-8 w-8" />
              <span className="sr-only">Acciones Rápidas</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 mb-2 p-2">
            <DropdownMenuItem onClick={() => setIsExpenseOpen(true)} className="cursor-pointer py-3 focus:bg-destructive/10">
              <TrendingDown className="mr-3 h-5 w-5 text-destructive" />
              <span className="font-semibold">Nuevo Gasto</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsIncomeOpen(true)} className="cursor-pointer py-3 focus:bg-green-500/10">
              <TrendingUp className="mr-3 h-5 w-5 text-green-500" />
              <span className="font-semibold">Nuevo Ingreso</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/transfers/new')} className="cursor-pointer py-3 focus:bg-blue-500/10">
              <ArrowLeftRight className="mr-3 h-5 w-5 text-blue-500" />
              <span className="font-semibold">Nueva Transferencia</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddExpenseDialog
        isOpen={isExpenseOpen}
        onOpenChange={setIsExpenseOpen}
        onExpenseSubmit={handleExpenseSubmit}
        isSubmitting={isSubmitting}
        expenseCategories={data.expenseCategories}
        wallets={data.wallets}
        properties={relevantProperties}
        liabilities={data.liabilities}
        initialData={initialData}
        title="Nuevo Gasto Rápido"
      />

      <AddIncomeDialog
        isOpen={isIncomeOpen}
        onOpenChange={setIsIncomeOpen}
        onIncomeSubmit={handleIncomeSubmit}
        isSubmitting={isSubmitting}
        incomeCategories={data.incomeCategories}
        wallets={data.wallets}
        properties={relevantProperties}
        initialData={initialData}
        title="Nuevo Ingreso Rápido"
      />
    </>
  );
}
