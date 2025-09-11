
'use client';

import * as React from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp, writeBatch, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Loader, Copy, ClipboardList, ReceiptText } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory, type Wallet, type Currency, type Liability } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseDialog } from './AddExpenseDialog';
import { AddExpectedExpenseDialog } from './AddExpectedExpenseDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { CopyExpectedExpensesDialog } from './CopyExpectedExpensesDialog';
import { DateNavigator } from '../shared/DateNavigator';

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


  // State for Expected Expenses
  const [isAddExpectedExpenseOpen, setIsAddExpectedExpenseOpen] = React.useState(false);
  const [editingExpectedExpense, setEditingExpectedExpense] = React.useState<ExpectedExpense | null>(null);
  const [deletingExpectedExpenseId, setDeletingExpectedExpenseId] = React.useState<string | null>(null);

  // State for copying expenses
  const [isCopyDialogOpen, setIsCopyDialogOpen] = React.useState(false);

  const filteredExpectedExpenses = React.useMemo(() => {
    return expectedExpenses.filter(expense => {
      const expenseYear = expense.year.toString();
      const expenseMonth = expense.month.toString();
      const yearMatch = selectedYear === 'all' || expenseYear === selectedYear;
      const monthMatch = selectedMonth === 'all' || expenseMonth === selectedMonth;
      return yearMatch && monthMatch;
    }).sort((a, b) => a.month - b.month);
  }, [expectedExpenses, selectedMonth, selectedYear]);

  const filteredActualExpenses = React.useMemo(() => {
    return actualExpenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const yearMatch = selectedYear === 'all' || expenseDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (expenseDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [actualExpenses, selectedMonth, selectedYear]);


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


  const getSubcategoryName = (id: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return subcategory.name;
    }
    return "Desconocido";
  };
  
  const getCategoryName = (subcategoryId: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      if (subcategory) return category.name;
    }
    return "Desconocido";
  };

  const getWalletName = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? wallet.name : "Desconocido";
  };


  const getPaidAmount = (expected: ExpectedExpense): number => {
    return actualExpenses
      .filter(actual => 
        actual.subcategoryId === expected.subcategoryId &&
        new Date(actual.date).getFullYear() === expected.year &&
        (new Date(actual.date).getMonth() + 1) === expected.month &&
        actual.currency === expected.currency
      )
      .reduce((sum, current) => sum + current.amount, 0);
  };
  
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
                if (revertedBalance < expenseData.amount) throw new Error("Fondos insuficientes en la billetera.");
                batch.update(newWalletRef, { balance: revertedBalance - expenseData.amount });
            } else {
                batch.update(oldWalletRef, { balance: revertedBalance });
                const newWalletSnap = await getDoc(newWalletRef);
                if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
                const newWalletData = newWalletSnap.data() as Wallet;
                if (newWalletData.balance < expenseData.amount) throw new Error("Fondos insuficientes en la billetera.");
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
            if (walletData.balance < expenseData.amount) {
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
        date: new Date(expense.year, expense.month - 1, new Date().getDate()),
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
    try {
      if(editingExpectedExpense) { // Editing existing expected expense
        const expenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', editingExpectedExpense.id);
        await updateDoc(expenseRef, data);
        toast({ title: "Gasto previsto actualizado exitosamente" });
      } else { // Adding new expected expense
        const expensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');
        await addDoc(expensesCol, data);
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

  const handleCopyExpenses = async (sourceYear: number, sourceMonth: number, numberOfMonths: number) => {
    setIsLoading(true);
    try {
      const expensesToCopy = expectedExpenses.filter(e => e.year === sourceYear && e.month === sourceMonth);

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
        let newMonth = sourceMonth + i;
        let newYear = sourceYear;

        if (newMonth > 12) {
            newYear += Math.floor((newMonth - 1) / 12);
            newMonth = ((newMonth - 1) % 12) + 1;
        }

        const existingExpensesInTargetMonth = expectedExpenses.filter(
          e => e.year === newYear && e.month === newMonth
        );

        for (const expense of expensesToCopy) {
            const alreadyExists = existingExpensesInTargetMonth.some(
              e => e.subcategoryId === expense.subcategoryId && e.currency === expense.currency
            );

            if (!alreadyExists) {
              const { id, ...expenseData } = expense;
              const newExpenseRef = doc(expensesCol); // Generate new ID
              batch.set(newExpenseRef, {
                  ...expenseData,
                  year: newYear,
                  month: newMonth,
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
                  <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="space-y-1">
                          <div className='text-sm text-muted-foreground'>Previsto</div>
                          <div className="font-bold text-blue-800 dark:text-blue-400 text-lg">{formatCurrency(totals.expected.ARS, 'ARS')}</div>
                          <div className="font-bold text-green-800 dark:text-green-400 text-lg">{formatCurrency(totals.expected.USD, 'USD')}</div>
                      </div>
                      <div className="space-y-1">
                          <div className='text-sm text-muted-foreground'>Pagado</div>
                          <div className="font-bold text-blue-800 dark:text-blue-400 text-lg">{formatCurrency(totals.paid.ARS, 'ARS')}</div>
                          <div className="font-bold text-green-800 dark:text-green-400 text-lg">{formatCurrency(totals.paid.USD, 'USD')}</div>
                      </div>
                      <div className="space-y-1">
                          <div className='text-sm text-muted-foreground'>Saldo</div>
                          <div className={cn("font-bold text-lg", totals.balance.ARS < 0 ? "text-destructive" : "text-blue-800 dark:text-blue-400")}>{formatCurrency(totals.balance.ARS, 'ARS')}</div>
                          <div className={cn("font-bold text-lg", totals.balance.USD < 0 ? "text-destructive" : "text-green-800 dark:text-green-400")}>{formatCurrency(totals.balance.USD, 'USD')}</div>
                      </div>
                  </div>
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
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Previsto</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Pagado</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredExpectedExpenses.length > 0 ? filteredExpectedExpenses.map(expense => {
                        const paidAmount = getPaidAmount(expense);
                        const balance = expense.amount - paidAmount;
                        return (
                            <TableRow key={expense.id} className="border-b-0 border-t border-dashed">
                                <TableCell>
                                    <div className='font-medium'>{getSubcategoryName(expense.subcategoryId)}</div>
                                    <div className='text-xs text-muted-foreground'>{getCategoryName(expense.subcategoryId)}</div>
                                </TableCell>
                                <TableCell className={cn(
                                    "text-right font-medium",
                                    {
                                        'text-green-800 dark:text-green-400': expense.currency === 'USD',
                                        'text-blue-800 dark:text-blue-400': expense.currency === 'ARS',
                                    }
                                )}>
                                    {formatCurrency(expense.amount, expense.currency)}
                                </TableCell>
                                <TableCell className={cn(
                                    "text-right font-medium hidden md:table-cell",
                                    {
                                        'text-green-800 dark:text-green-400': expense.currency === 'USD',
                                        'text-blue-800 dark:text-blue-400': expense.currency === 'ARS',
                                    }
                                )}>
                                    {formatCurrency(paidAmount, expense.currency)}
                                </TableCell>
                                <TableCell 
                                  className={cn("text-right font-medium cursor-pointer", balance > 0 ? "text-red-500" : "text-green-500")}
                                  onClick={() => handleAddActualFromExpected(expense)}
                                >
                                  {formatCurrency(balance, expense.currency)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditExpected(expense)}>
                                            <Pencil className="h-4 w-4" />
                                            <span className="sr-only">Editar Gasto Previsto</span>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteExpected(expense.id)}>
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">Eliminar Gasto Previsto</span>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                            No hay gastos previstos para mostrar para el período seleccionado.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
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
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="hidden md:table-cell">Billetera</TableHead>
                        <TableHead className="hidden md:table-cell">Notas</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredActualExpenses.length > 0 ? filteredActualExpenses.map(expense => (
                        <TableRow key={expense.id}>
                        <TableCell>{new Date(expense.date).toLocaleDateString('es-ES')}</TableCell>
                        <TableCell>
                                <div className='font-medium'>{getSubcategoryName(expense.subcategoryId)}</div>
                            <div className='text-xs text-muted-foreground'>{getCategoryName(expense.subcategoryId)}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{getWalletName(expense.walletId)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{expense.notes}</TableCell>
                        <TableCell className="text-right font-medium">
                            {formatCurrency(expense.amount, expense.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditActual(expense)}>
                                    <Pencil className="h-4 w-4" />
                                    <span className="sr-only">Editar Gasto</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteActual(expense.id)}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Eliminar Gasto</span>
                                </Button>
                            </div>
                        </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                            No hay gastos reales para mostrar para el período seleccionado.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
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

    
