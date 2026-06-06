
'use client';

import * as React from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp, writeBatch, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Loader, Copy, ClipboardList, ReceiptText, CheckCircle, ClipboardPlus, ArrowUp, ArrowDown, FileText } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory, type Wallet, type Currency, type Liability } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseDialog } from './AddExpenseDialog';
import { AddExpectedExpenseDialog } from './AddExpectedExpenseDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { CopyExpectedExpensesDialog } from './CopyExpectedExpensesDialog';
import { DateNavigator } from '../shared/DateNavigator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SortableHeader, type SortConfig } from '../shared/SortableHeader';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type PropertyExpensesProps = {
  propertyId: string;
  expenseCategories: ExpenseCategory[];
  wallets: Wallet[];
  liabilities: Liability[];
  selectedMonth: string;
  selectedYear: string;
  actualExpenses: Omit<ActualExpense, 'propertyId' | 'propertyName'>[];
  expectedExpenses: ExpectedExpense[];
  onTransactionUpdate: () => void;
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
};

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};


export function PropertyExpenses({ 
  propertyId, 
  expenseCategories, 
  wallets, 
  liabilities,
  selectedMonth, 
  selectedYear,
  actualExpenses,
  expectedExpenses,
  onTransactionUpdate,
  currentDate,
  onDateChange,
}: PropertyExpensesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  
  // State for Actual Expenses
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<Omit<ActualExpense, 'propertyId' | 'propertyName'> | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null);
  const [initialExpenseData, setInitialExpenseData] = React.useState<Partial<Omit<ActualExpense, 'propertyId' | 'propertyName'>> | null>(null);
  const [actualSortConfig, setActualSortConfig] = React.useState<SortConfig<any>>({ key: 'date', direction: 'desc' });


  // State for Expected Expenses
  const [isAddExpectedExpenseOpen, setIsAddExpectedExpenseOpen] = React.useState(false);
  const [editingExpectedExpense, setEditingExpectedExpense] = React.useState<ExpectedExpense | null>(null);
  const [deletingExpectedExpenseId, setDeletingExpectedExpenseId] = React.useState<string | null>(null);
  const [expectedSortConfig, setExpectedSortConfig] = React.useState<SortConfig<any>>({ key: 'date', direction: 'asc' });


  // State for copying expenses
  const [isCopyDialogOpen, setIsCopyDialogOpen] = React.useState(false);

  const getSubcategoryName = React.useCallback((id: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return subcategory.name;
    }
    return "Desconocido";
  }, [expenseCategories]);
  
  const getCategoryName = React.useCallback((subcategoryId: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      if (subcategory) return category.name;
    }
    return "Desconocido";
  }, [expenseCategories]);

  const filteredExpectedExpenses = React.useMemo(() => {
    let expenses = expectedExpenses.map(expense => {
      if ((expense as any).month && (expense as any).year && !expense.date) {
        return {
          ...expense,
          date: new Date((expense as any).year, (expense as any).month - 1, 5).toISOString(),
        };
      }
      return expense;
    }).filter(expense => {
      const expenseDate = new Date(expense.date);
      const yearMatch = selectedYear === 'all' || expenseDate.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'all' || (expenseDate.getMonth() + 1).toString() === selectedMonth;
      return yearMatch && monthMatch;
    }).map(e => ({
        ...e,
        subcategoryName: getSubcategoryName(e.subcategoryId),
        categoryName: getCategoryName(e.subcategoryId),
    }));

     if (expectedSortConfig) {
      expenses.sort((a, b) => {
        const aValue = a[expectedSortConfig.key as keyof typeof a];
        const bValue = b[expectedSortConfig.key as keyof typeof b];
        if (aValue < bValue) return expectedSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return expectedSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return expenses;

  }, [expectedExpenses, selectedMonth, selectedYear, expectedSortConfig, getSubcategoryName, getCategoryName]);

  const filteredActualExpenses = React.useMemo(() => {
    let expenses = actualExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const yearMatch = selectedYear === 'all' || expenseDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (expenseDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    }).map(e => ({
        ...e,
        subcategoryName: getSubcategoryName(e.subcategoryId),
        categoryName: getCategoryName(e.subcategoryId),
        walletName: wallets.find(w => w.id === e.walletId)?.name || 'N/A'
    }));

    if (actualSortConfig) {
      expenses.sort((a, b) => {
        const aValue = a[actualSortConfig.key as keyof typeof a];
        const bValue = b[actualSortConfig.key as keyof typeof b];
        if (aValue < bValue) return actualSortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return actualSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return expenses;
  }, [actualExpenses, selectedMonth, selectedYear, actualSortConfig, getSubcategoryName, getCategoryName, wallets]);


  const totals = React.useMemo(() => {
    const expected = { ARS: 0, USD: 0 };
    const paid = { ARS: 0, USD: 0 };
    const balance = { ARS: 0, USD: 0 };

    filteredExpectedExpenses.forEach(exp => {
      expected[exp.currency] += exp.amount;
    });

    filteredActualExpenses.forEach(exp => {
      paid[exp.currency] += exp.amount;
    });

    balance.ARS = expected.ARS - paid.ARS;
    balance.USD = expected.USD - paid.USD;

    return { expected, paid, balance };
  }, [filteredExpectedExpenses, filteredActualExpenses]);

  const getWalletName = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? wallet.name : "Desconocido";
  };


  const getPaidAmount = React.useCallback((expected: ExpectedExpense): number => {
    const expectedDate = new Date(expected.date);
    return actualExpenses
      .filter(actual => {
        const actualDate = new Date(actual.date);
        return actual.subcategoryId === expected.subcategoryId &&
          actualDate.getFullYear() === expectedDate.getFullYear() &&
          actualDate.getMonth() === expectedDate.getMonth() &&
          actual.currency === expected.currency
      })
      .reduce((sum, current) => sum + current.amount, 0);
  }, [actualExpenses]);
  
  // --- Actual Expense Handlers ---
  const handleActualExpenseSubmit = async (data: any) => {
    const batch = writeBatch(db);
    setIsLoading(true);

    const expenseData = { ...data };
    if (expenseData.liabilityId === 'none') {
        expenseData.liabilityId = null;
    }

    try {
        if (editingExpense) { // Editing existing expense
            const expenseRef = doc(db, 'properties', propertyId, 'actualExpenses', editingExpense.id);
            const oldWalletRef = doc(db, 'wallets', editingExpense.walletId);
            const newWalletRef = doc(db, 'wallets', expenseData.walletId);

            const oldWalletSnap = await getDoc(oldWalletRef);
            if(!oldWalletSnap.exists()) throw new Error("La billetera original no fue encontrada.");
            const oldWalletData = oldWalletSnap.data() as Wallet;

            const revertedBalance = oldWalletData.balance + editingExpense.amount;
            
            if (editingExpense.walletId === expenseData.walletId) {
                if (revertedBalance < expenseData.amount && !oldWalletData.allowNegativeBalance) throw new Error("Fondos insuficientes en la billetera.");
                batch.update(newWalletRef, { balance: revertedBalance - expenseData.amount });
            } else {
                batch.update(oldWalletRef, { balance: revertedBalance });
                const newWalletSnap = await getDoc(newWalletRef);
                if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
                const newWalletData = newWalletSnap.data() as Wallet;
                if (newWalletData.balance < expenseData.amount && !newWalletData.allowNegativeBalance) throw new Error("Fondos insuficientes en la billetera.");
                batch.update(newWalletRef, { balance: newWalletData.balance - expenseData.amount });
            }

            batch.update(expenseRef, { ...expenseData, date: Timestamp.fromDate(expenseData.date) });
            toast({ title: "Gasto actualizado exitosamente" });

        } else { // Adding new expense
            const expenseRef = doc(collection(db, 'properties', propertyId, 'actualExpenses'));
            const walletRef = doc(db, 'wallets', expenseData.walletId);
            
            const walletSnap = await getDoc(walletRef);
            if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
            
            const walletData = walletSnap.data() as Wallet;
            if (walletData.balance < expenseData.amount && !walletData.allowNegativeBalance) {
                 toast({ title: "Fondos insuficientes", description: `La billetera ${walletData.name} no tiene suficiente saldo.`, variant: "destructive" });
                 setIsLoading(false);
                 return;
            }
            const newBalance = walletData.balance - expenseData.amount;

            batch.update(walletRef, { balance: newBalance });
            batch.set(expenseRef, { ...expenseData, date: Timestamp.fromDate(expenseData.date) });
            
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
                        notes: `Pago registrado desde la cuenta`,
                        actualExpenseId: expenseRef.id,
                        propertyId: propertyId,
                    };
                    batch.set(paymentRef, paymentData);
                }
            }

            // Auto-mark expected expense as paid if applicable
            const expenseDate = expenseData.date as Date;
            const correspondingExpected = filteredExpectedExpenses.find(exp => 
                exp.subcategoryId === expenseData.subcategoryId &&
                exp.currency === expenseData.currency &&
                new Date(exp.date).getMonth() === expenseDate.getMonth() &&
                new Date(exp.date).getFullYear() === expenseDate.getFullYear()
            );

            if (correspondingExpected) {
                const alreadyPaidAmount = getPaidAmount(correspondingExpected);
                const totalPaid = alreadyPaidAmount + expenseData.amount;
                if (totalPaid >= correspondingExpected.amount) {
                    const expectedExpenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', correspondingExpected.id);
                    batch.update(expectedExpenseRef, { isPaid: true });
                }
            }
            
            toast({ title: "Gasto añadido exitosamente" });
        }
        await batch.commit();
        onTransactionUpdate();
        closeDialogs();
    } catch(error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el gasto.";
        console.error("Error saving actual expense:", error);
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }

  const handleAddActualFromExpected = (expense: ExpectedExpense) => {
    const paidAmount = getPaidAmount(expense);
    const remainingAmount = expense.amount - paidAmount;

    setInitialExpenseData({
        subcategoryId: expense.subcategoryId,
        amount: remainingAmount > 0 ? remainingAmount : 0,
        currency: expense.currency,
        date: new Date(expense.date),
    });
    setEditingExpense(null);
    setIsAddExpenseOpen(true);
  }

  const handleEditActual = (expense: Omit<ActualExpense, 'propertyId' | 'propertyName'>) => {
    setEditingExpense(expense);
    setInitialExpenseData(null);
    setIsAddExpenseOpen(true);
  };
  
  const handleDeleteActual = (expenseId: string) => {
    setDeletingExpenseId(expenseId);
  };

  const confirmDeleteActual = async () => {
    if (!deletingExpenseId) return;

    const expenseToDelete = actualExpenses.find(e => e.id === deletingExpenseId);
    if (!expenseToDelete) {
        toast({ title: "Error", description: "No se encontró el gasto a eliminar.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const batch = writeBatch(db);
    const expenseRef = doc(db, 'properties', propertyId, 'actualExpenses', deletingExpenseId);
    const walletRef = doc(db, 'wallets', expenseToDelete.walletId);
        
    try {
        const walletSnap = await getDoc(walletRef);
        if (walletSnap.exists()) {
            const walletData = walletSnap.data() as Wallet;
            const newBalance = walletData.balance + expenseToDelete.amount;
            batch.update(walletRef, { balance: newBalance });
        }
        
        if (expenseToDelete.liabilityId) {
            const liabilityRef = doc(db, 'liabilities', expenseToDelete.liabilityId);
            const liabilitySnap = await getDoc(liabilityRef);
            if (liabilitySnap.exists()) {
                const liabilityData = liabilitySnap.data() as Liability;
                batch.update(liabilityRef, { outstandingBalance: liabilityData.outstandingBalance + expenseToDelete.amount });

                const paymentsRef = collection(db, 'liabilities', expenseToDelete.liabilityId, 'payments');
                const q = query(paymentsRef, where('actualExpenseId', '==', expenseToDelete.id));
                const paymentsSnap = await getDocs(q);
                paymentsSnap.forEach(paymentDoc => {
                    batch.delete(paymentDoc.ref);
                });
            }
        }

        batch.delete(expenseRef);
        await batch.commit();

        toast({ title: "Elemento eliminado", variant: "destructive" });
        setDeletingExpenseId(null);
        onTransactionUpdate();
    } catch(error) {
        console.error("Error deleting actual expense:", error);
        toast({ title: "Error", description: "No se pudo eliminar el gasto.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }

  // --- Expected Expense Handlers ---
  const handleExpectedExpenseSubmit = async (data: any) => {
    setIsLoading(true);
    // Ensure `date` from form is converted to a Timestamp
    const { date, ...rest } = data;
    const expenseData = { ...rest, date: Timestamp.fromDate(date) };

    try {
      if(editingExpectedExpense) { // Editing existing expected expense
        const expenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', editingExpectedExpense.id);
        await updateDoc(expenseRef, expenseData);
        toast({ title: "Gasto previsto actualizado exitosamente" });
      } else { // Adding new expected expense
        const expensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');
        await addDoc(expensesCol, expenseData);
        toast({ title: "Gasto previsto añadido exitosamente" });
      }
      onTransactionUpdate();
      closeDialogs();
    } catch(error) {
        console.error("Error saving expected expense:", error);
        toast({ title: "Error", description: "No se pudo guardar el gasto previsto.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }

  const handleEditExpected = (expense: ExpectedExpense) => {
    setEditingExpectedExpense(expense);
    setIsAddExpectedExpenseOpen(true);
  }

  const handleDeleteExpected = (expenseId: string) => {
    setDeletingExpectedExpenseId(expenseId);
  }

  const handleToggleIsPaid = async (expense: ExpectedExpense) => {
      setIsLoading(true);
      try {
          const expenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', expense.id);
          await updateDoc(expenseRef, { isPaid: !expense.isPaid });
          toast({ title: "Estado de pago actualizado" });
          onTransactionUpdate();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo actualizar el estado de pago.", variant: "destructive"});
      } finally {
          setIsLoading(false);
      }
  }

  const confirmDeleteExpected = async () => {
    if (deletingExpectedExpenseId) {
        setIsLoading(true);
        try {
            const expenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', deletingExpectedExpenseId);
            await deleteDoc(expenseRef);
            toast({ title: "Elemento eliminado", variant: "destructive" });
            setDeletingExpectedExpenseId(null);
            onTransactionUpdate();
        } catch(error) {
            console.error("Error deleting expected expense:", error);
            toast({ title: "Error", description: "No se pudo eliminar el gasto previsto.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }
  }

  const handleCreateExpectedFromActual = async (expense: Omit<ActualExpense, 'propertyId' | 'propertyName'>) => {
    setIsLoading(true);

    const targetDate = currentDate;
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;

    try {
        const alreadyExists = filteredExpectedExpenses.some(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getFullYear() === targetYear &&
                   (expenseDate.getMonth() + 1) === targetMonth &&
                   e.subcategoryId === expense.subcategoryId &&
                   e.currency === expense.currency;
        });

        if (alreadyExists) {
            toast({
                title: "Gasto previsto ya existe",
                description: "Ya existe un gasto previsto para esta categoría en el mes seleccionado.",
                variant: "default",
            });
            return;
        }

        const newExpectedDate = new Date(targetYear, targetMonth - 1, new Date(expense.date).getDate());

        const newExpectedExpense = {
            subcategoryId: expense.subcategoryId,
            amount: expense.amount,
            currency: expense.currency,
            date: Timestamp.fromDate(newExpectedDate),
            isPaid: false,
        };

        const expensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');
        await addDoc(expensesCol, newExpectedExpense);

        toast({
            title: "Gasto Previsto Creado",
            description: "El gasto se ha añadido a la lista de gastos previstos de este mes.",
        });
        onTransactionUpdate();
    } catch (error) {
        console.error("Error creating expected expense from actual:", error);
        toast({ title: "Error", description: "No se pudo crear el gasto previsto.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


  const handleCopyExpenses = async (sourceYear: number, sourceMonth: number, numberOfMonths: number) => {
    setIsLoading(true);
    try {
      const expensesToCopy = expectedExpenses.filter(e => {
          const expenseDate = new Date(e.date);
          return expenseDate.getFullYear() === sourceYear && (expenseDate.getMonth() + 1) === sourceMonth;
      });

      if (expensesToCopy.length === 0) {
        toast({ title: "Sin gastos", description: "No hay gastos previstos en el mes de origen para copiar.", variant: "destructive" });
        setIsLoading(false);
        setIsCopyDialogOpen(false);
        return;
      }

      const batch = writeBatch(db);
      const expensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');
      let createdCount = 0;

      for (let i = 1; i <= numberOfMonths; i++) {
        const sourceDate = new Date(sourceYear, sourceMonth - 1, 1);
        const targetDate = new Date(sourceDate.setMonth(sourceDate.getMonth() + i));
        
        const newYear = targetDate.getFullYear();
        const newMonth = targetDate.getMonth() + 1;

        const existingExpensesInTargetMonth = expectedExpenses.filter(
          e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getFullYear() === newYear && (expenseDate.getMonth() + 1) === newMonth;
          }
        );

        for (const expense of expensesToCopy) {
            const alreadyExists = existingExpensesInTargetMonth.some(
              e => e.subcategoryId === expense.subcategoryId && e.currency === expense.currency
            );

            if (!alreadyExists) {
              const { id, ...expenseData } = expense;
              const newExpenseRef = doc(expensesCol); // Generate new ID
              
              const originalDate = new Date(expense.date);
              const newExpenseDate = new Date(originalDate);
              newExpenseDate.setFullYear(newYear);
              newExpenseDate.setMonth(newMonth - 1);
              
              batch.set(newExpenseRef, {
                  ...expenseData,
                  date: Timestamp.fromDate(newExpenseDate),
                  isPaid: false, // Always copy as unpaid
              });
              createdCount++;
            }
        }
      }

      if (createdCount > 0) {
        await batch.commit();
        toast({ title: "Gastos Copiados", description: `${createdCount} gastos nuevos se copiaron a los próximos ${numberOfMonths} meses.` });
        onTransactionUpdate();
      } else {
        toast({ title: "Sin cambios", description: "No se crearon gastos nuevos porque ya existían en los meses de destino." });
      }

    } catch(e) {
      console.error("Error copying expenses", e);
      toast({ title: "Error", description: "No se pudieron copiar los gastos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsCopyDialogOpen(false);
    }
  }

  // --- Dialog Management ---
  const closeDialogs = () => {
    setIsAddExpenseOpen(false);
    setEditingExpense(null);
    setInitialExpenseData(null);
    setIsAddExpectedExpenseOpen(false);
    setEditingExpectedExpense(null);
  }


  return (
    <>
      <Card>
        <CardHeader>
             <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <CardTitle>Gastos</CardTitle>
                <DateNavigator
                    currentDate={currentDate}
                    onDateChange={onDateChange}
                />
            </div>
        </CardHeader>
        <Tabs defaultValue="overview">
          <CardContent className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="overview">Presupuesto</TabsTrigger>
              <TabsTrigger value="actual">Gastos</TabsTrigger>
            </TabsList>
            
            <div className="p-4 border rounded-lg">
                  <h4 className="text-lg font-semibold text-center mb-2">Totales del Período</h4>
                  <TooltipProvider>
                  <div className="flex flex-col sm:flex-row sm:justify-around text-center gap-4">
                      <div className="space-y-1">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div className='text-sm text-muted-foreground cursor-help underline decoration-dotted underline-offset-2'>Previsto</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>El total de gastos planificados para este período.</p>
                              </TooltipContent>
                          </Tooltip>
                          <div className="font-bold text-blue-800 dark:text-blue-400 text-lg">{formatCurrency(totals.expected.ARS, 'ARS')}</div>
                          <div className="font-bold text-green-800 dark:text-green-400 text-lg">{formatCurrency(totals.expected.USD, 'USD')}</div>
                      </div>
                      <div className="space-y-1">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div className='text-sm text-muted-foreground cursor-help underline decoration-dotted underline-offset-2'>Pagado</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>El total de gastos realmente efectuados en este período.</p>
                              </TooltipContent>
                          </Tooltip>
                          <div className="font-bold text-blue-800 dark:text-blue-400 text-lg">{formatCurrency(totals.paid.ARS, 'ARS')}</div>
                          <div className="font-bold text-green-800 dark:text-green-400 text-lg">{formatCurrency(totals.paid.USD, 'USD')}</div>
                      </div>
                      <div className="space-y-1">
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <div className='text-sm text-muted-foreground cursor-help underline decoration-dotted underline-offset-2'>Saldo</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>La diferencia entre lo previsto y lo pagado.</p>
                              </TooltipContent>
                          </Tooltip>
                          <div className={cn("font-bold text-lg", totals.balance.ARS < 0 ? "text-destructive" : "text-blue-800 dark:text-blue-400")}>{formatCurrency(totals.balance.ARS, 'ARS')}</div>
                          <div className={cn("font-bold text-lg", totals.balance.USD < 0 ? "text-destructive" : "text-green-800 dark:text-green-400")}>{formatCurrency(totals.balance.USD, 'USD')}</div>
                      </div>
                  </div>
                  </TooltipProvider>
            </div>

            <TabsContent value="overview">
                <div className='flex justify-between items-center mb-4 gap-2 flex-wrap'>
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Gastos Previstos</h3>
                            <p className="text-sm text-muted-foreground">Presupuesto de gastos y su estado de pago.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setIsCopyDialogOpen(true)} disabled={isLoading}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar Mes
                        </Button>
                        <Button onClick={() => { setEditingExpectedExpense(null); setIsAddExpectedExpenseOpen(true); }} disabled={isLoading}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Previsto
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                  <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-end gap-2 my-4">
                        <Label htmlFor="sort-select-expected" className="text-sm font-medium">Ordenar por:</Label>
                        <Select
                            value={expectedSortConfig?.key as string}
                            onValueChange={(value) => setExpectedSortConfig({ key: value, direction: expectedSortConfig?.direction || 'asc' })}
                        >
                            <SelectTrigger id="sort-select-expected" className="w-auto h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Fecha</SelectItem>
                                <SelectItem value="subcategoryName">Categoría</SelectItem>
                                <SelectItem value="amount">Monto Previsto</SelectItem>
                            </SelectContent>
                        </Select>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline" size="icon" className="h-9 w-9"
                                    onClick={() => setExpectedSortConfig({ key: expectedSortConfig?.key || 'date', direction: expectedSortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
                                >
                                    {expectedSortConfig?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Cambiar orden</p></TooltipContent>
                        </Tooltip>
                    </div>
                      {filteredExpectedExpenses.length > 0 ? filteredExpectedExpenses.map(expense => {
                        const paidAmount = getPaidAmount(expense);
                        const balance = expense.amount - paidAmount;
                        const isPaid = expense.isPaid || balance <= 0;
                        return(
                          <Card key={expense.id} className={cn("p-3", isPaid && "bg-muted text-muted-foreground line-through")}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{expense.subcategoryName}</p>
                                <p className="text-xs">{expense.categoryName}</p>
                                <p className="text-xs">Vence: {format(new Date(expense.date), 'dd/MM/yyyy')}</p>
                              </div>
                               <div className="flex items-center gap-0">
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleToggleIsPaid(expense)}><CheckCircle className="h-4 w-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Marcar como pagado</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleAddActualFromExpected(expense)}><ReceiptText className="h-4 w-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Registrar pago</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className={cn("h-8 w-8", expense.notes ? "text-yellow-500" : "text-muted-foreground")} onClick={() => handleEditExpected(expense)}>
                                              <FileText className="h-4 w-4" />
                                          </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>{expense.notes ? "Ver/Editar nota" : "Agregar nota"}</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditExpected(expense)}><Pencil className="h-4 w-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Editar previsto</p></TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                      <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteExpected(expense.id)}><Trash2 className="h-4 w-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Eliminar previsto</p></TooltipContent>
                                  </Tooltip>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Previsto:</span>
                                <span className="font-medium">{formatCurrency(expense.amount, expense.currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Pagado:</span>
                                <span className="font-medium">{formatCurrency(paidAmount, expense.currency)}</span>
                              </div>
                              <div className="flex justify-between border-t mt-1 pt-1">
                                <span className="font-semibold">Saldo:</span>
                                <span className={cn("font-semibold", balance > 0 ? "text-red-500" : "text-green-500", isPaid && "text-muted-foreground")}>{formatCurrency(balance, expense.currency)}</span>
                              </div>
                            </div>
                            {expense.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{expense.notes}</p>}
                          </Card>
                        )
                      }) : (
                        <div className="text-center text-muted-foreground py-10">No hay gastos previstos.</div>
                      )}
                  </div>
                  </>
                )}
            </TabsContent>

            <TabsContent value="actual">
                <div className='flex justify-between items-center mb-4'>
                    <div className="flex items-center gap-2">
                        <ReceiptText className="h-5 w-5 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold">Gastos Realizados</h3>
                            <p className="text-sm text-muted-foreground">Lista de todos los gastos individuales registrados.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => { setEditingExpense(null); setInitialExpenseData(null); setIsAddExpenseOpen(true); }} disabled={isLoading}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Gasto
                        </Button>
                    </div>
                </div>
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                  <>
                   <div className="space-y-2">
                    <div className="flex items-center justify-end gap-2 my-4">
                        <Label htmlFor="sort-select-actual" className="text-sm font-medium">Ordenar por:</Label>
                        <Select
                            value={actualSortConfig?.key as string}
                            onValueChange={(value) => setActualSortConfig({ key: value, direction: actualSortConfig?.direction || 'desc' })}
                        >
                            <SelectTrigger id="sort-select-actual" className="w-auto h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="date">Fecha</SelectItem>
                                <SelectItem value="categoryName">Categoría</SelectItem>
                                <SelectItem value="amount">Monto</SelectItem>
                            </SelectContent>
                        </Select>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline" size="icon" className="h-9 w-9"
                                    onClick={() => setActualSortConfig({ key: actualSortConfig?.key || 'date', direction: actualSortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
                                >
                                    {actualSortConfig?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Cambiar orden</p></TooltipContent>
                        </Tooltip>
                    </div>
                        {filteredActualExpenses.length > 0 ? filteredActualExpenses.map(expense => {
                          const alreadyExistsAsExpected = filteredExpectedExpenses.some(e => {
                              const expenseDate = new Date(expense.date);
                              const expectedDate = new Date(e.date);
                              return e.subcategoryId === expense.subcategoryId &&
                                  e.currency === expense.currency &&
                                  expectedDate.getFullYear() === expenseDate.getFullYear() &&
                                  expectedDate.getMonth() === expenseDate.getMonth();
                          });
                          return (
                          <Card key={expense.id} className="p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold">{expense.subcategoryName}</p>
                                  <p className="text-xs text-muted-foreground">{expense.categoryName}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(expense.date).toLocaleDateString('es-ES')} | {expense.walletName}</p>
                                </div>
                                <div className="font-bold text-destructive">{formatCurrency(expense.amount, expense.currency)}</div>
                              </div>
                              {expense.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{expense.notes}</p>}
                               <div className="flex items-center justify-end gap-0 -mb-2 -mr-2 mt-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCreateExpectedFromActual(expense)} disabled={alreadyExistsAsExpected}>
                                                <ClipboardPlus className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Crear gasto previsto</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditActual(expense)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Editar gasto</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteActual(expense.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Eliminar gasto</p></TooltipContent>
                                    </Tooltip>
                                </div>
                          </Card>
                        )}) : (
                           <div className="text-center text-muted-foreground py-10">No hay gastos reales.</div>
                        )}
                   </div>
                  </>
                )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
      
      {/* Dialog for Actual Expenses */}
      <AddExpenseDialog
        key={editingExpense ? `edit-${editingExpense.id}` : (initialExpenseData ? `add-init-${initialExpenseData.subcategoryId}`: 'add')}
        isOpen={isAddExpenseOpen}
        onOpenChange={closeDialogs}
        expenseCategories={expenseCategories}
        wallets={wallets}
        liabilities={liabilities}
        onExpenseSubmit={handleActualExpenseSubmit}
        expenseToEdit={editingExpense}
        initialData={initialExpenseData}
      />
      <ConfirmDeleteDialog
        isOpen={!!deletingExpenseId}
        onOpenChange={() => setDeletingExpenseId(null)}
        onConfirm={confirmDeleteActual}
        title="¿Estás seguro de que deseas eliminar este gasto?"
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el gasto y revertirá el monto en la billetera asociada."
       />

      {/* Dialog for Expected Expenses */}
      <AddExpectedExpenseDialog
        key={editingExpectedExpense ? `edit-exp-${editingExpectedExpense.id}` : 'add-exp'}
        isOpen={isAddExpectedExpenseOpen}
        onOpenChange={closeDialogs}
        expenseCategories={expenseCategories}
        onExpenseSubmit={handleExpectedExpenseSubmit}
        expenseToEdit={editingExpectedExpense}
      />
      <ConfirmDeleteDialog
        isOpen={!!deletingExpectedExpenseId}
        onOpenChange={() => setDeletingExpectedExpenseId(null)}
        onConfirm={confirmDeleteExpected}
        title="¿Estás seguro de que deseas eliminar este gasto previsto?"
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el gasto previsto de tus registros."
      />
      <CopyExpectedExpensesDialog
        isOpen={isCopyDialogOpen}
        onOpenChange={setIsCopyDialogOpen}
        onConfirm={handleCopyExpenses}
      />
    </>
  );
}

    