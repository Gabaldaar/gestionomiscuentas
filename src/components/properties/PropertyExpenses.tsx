
'use client';

import * as React from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Loader, Copy } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory, type Wallet } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseDialog } from './AddExpenseDialog';
import { AddExpectedExpenseDialog } from './AddExpectedExpenseDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { CopyExpectedExpensesDialog } from './CopyExpectedExpensesDialog';

type PropertyExpensesProps = {
  propertyId: string;
  expenseCategories: ExpenseCategory[];
  wallets: Wallet[];
  selectedMonth: string;
  selectedYear: string;
  actualExpenses: ActualExpense[];
  expectedExpenses: ExpectedExpense[];
  onTransactionUpdate: () => void;
};

export function PropertyExpenses({ 
  propertyId, 
  expenseCategories, 
  wallets, 
  selectedMonth, 
  selectedYear,
  actualExpenses,
  expectedExpenses,
  onTransactionUpdate,
}: PropertyExpensesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  
  // State for Actual Expenses
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<ActualExpense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null);
  const [initialExpenseData, setInitialExpenseData] = React.useState<Partial<ActualExpense> | null>(null);


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
  
  const getStatus = (expectedAmount: number, paidAmount: number): { text: string; color: 'bg-green-500' | 'bg-yellow-500' | 'bg-red-500' } => {
    if (paidAmount === 0) {
      return { text: 'Pendiente', color: 'bg-red-500' };
    }
    if (paidAmount < expectedAmount) {
      return { text: 'Parcial', color: 'bg-yellow-500' };
    }
    return { text: 'Pagado', color: 'bg-green-500' };
  };

  // --- Actual Expense Handlers ---
  const handleActualExpenseSubmit = async (data: any) => {
    const batch = writeBatch(db);
    setIsLoading(true);

    try {
        if (editingExpense) { // Editing existing expense
            const expenseRef = doc(db, 'properties', propertyId, 'actualExpenses', editingExpense.id);
            const oldWalletRef = doc(db, 'wallets', editingExpense.walletId);
            const newWalletRef = doc(db, 'wallets', data.walletId);

            const oldWalletSnap = await getDoc(oldWalletRef);
            if(!oldWalletSnap.exists()) throw new Error("La billetera original no fue encontrada.");
            const oldWalletData = oldWalletSnap.data() as Wallet;

            const revertedBalance = oldWalletData.balance + editingExpense.amount;
            
            if (editingExpense.walletId === data.walletId) {
                if (revertedBalance < data.amount) throw new Error("Fondos insuficientes en la billetera.");
                batch.update(newWalletRef, { balance: revertedBalance - data.amount });
            } else {
                batch.update(oldWalletRef, { balance: revertedBalance });
                const newWalletSnap = await getDoc(newWalletRef);
                if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
                const newWalletData = newWalletSnap.data() as Wallet;
                if (newWalletData.balance < data.amount) throw new Error("Fondos insuficientes en la billetera.");
                batch.update(newWalletRef, { balance: newWalletData.balance - data.amount });
            }

            batch.update(expenseRef, { ...data, date: Timestamp.fromDate(data.date) });
            toast({ title: "Gasto actualizado exitosamente" });

        } else { // Adding new expense
            const expenseRef = doc(collection(db, 'properties', propertyId, 'actualExpenses'));
            const walletRef = doc(db, 'wallets', data.walletId);
            
            const walletSnap = await getDoc(walletRef);
            if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
            
            const walletData = walletSnap.data() as Wallet;
            if (walletData.balance < data.amount) {
                 toast({ title: "Fondos insuficientes", description: `La billetera ${walletData.name} no tiene suficiente saldo.`, variant: "destructive" });
                 setIsLoading(false);
                 return;
            }
            const newBalance = walletData.balance - data.amount;

            batch.update(walletRef, { balance: newBalance });
            batch.set(expenseRef, { ...data, date: Timestamp.fromDate(data.date) });
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
        date: new Date(expense.year, expense.month - 1, new Date().getDate()).toISOString(),
    });
    setEditingExpense(null);
    setIsAddExpenseOpen(true);
  }

  const handleEditActual = (expense: ActualExpense) => {
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
        return;
      }

      const batch = writeBatch(db);
      const expensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');

      for (let i = 1; i <= numberOfMonths; i++) {
        let newMonth = sourceMonth + i;
        let newYear = sourceYear;

        if (newMonth > 12) {
            newYear += Math.floor((newMonth - 1) / 12);
            newMonth = ((newMonth - 1) % 12) + 1;
        }

        for (const expense of expensesToCopy) {
            const { id, ...expenseData } = expense;
            const newExpenseRef = doc(expensesCol); // Generate new ID
            batch.set(newExpenseRef, {
                ...expenseData,
                year: newYear,
                month: newMonth,
            });
        }
      }

      await batch.commit();
      toast({ title: "Gastos Copiados", description: `Los gastos se copiaron a los próximos ${numberOfMonths} meses.` });
      onTransactionUpdate();
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
        <Tabs defaultValue="overview">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Gastos</CardTitle>
            <TabsList className="grid grid-cols-2 w-full max-w-[300px]">
              <TabsTrigger value="overview">Presupuesto</TabsTrigger>
              <TabsTrigger value="actual">Gastos</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="overview">
                <div className='flex justify-between items-center mb-4 gap-2 flex-wrap'>
                    <div>
                        <h3 className="text-lg font-semibold">Gastos Previstos</h3>
                        <p className="text-sm text-muted-foreground">Una descripción general de tus gastos previstos y su estado.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setIsCopyDialogOpen(true)} disabled={isLoading}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copiar Mes
                        </Button>
                        <Button onClick={() => { setEditingExpectedExpense(null); setIsAddExpectedExpenseOpen(true); }} disabled={isLoading}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Gasto Previsto
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
                        <TableHead>Período</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Previsto</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Pagado</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredExpectedExpenses.length > 0 ? filteredExpectedExpenses.map(expense => {
                        const paidAmount = getPaidAmount(expense);
                        const status = getStatus(expense.amount, paidAmount);
                        return (
                            <TableRow key={expense.id}>
                                <TableCell>{expense.month}/{expense.year}</TableCell>
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
                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(expense.amount)}
                                </TableCell>
                                <TableCell className={cn(
                                    "text-right font-medium hidden md:table-cell",
                                    {
                                        'text-green-800 dark:text-green-400': expense.currency === 'USD',
                                        'text-blue-800 dark:text-blue-400': expense.currency === 'ARS',
                                    }
                                )}>
                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(paidAmount)}
                                </TableCell>
                                <TableCell>
                                    <Badge 
                                        variant="outline" 
                                        className='flex items-center gap-2 cursor-pointer hover:bg-secondary'
                                        onClick={() => handleAddActualFromExpected(expense)}
                                    >
                                        <span className={`h-2 w-2 rounded-full ${status.color}`}></span>
                                        {status.text}
                                    </Badge>
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
                    <div>
                        <h3 className="text-lg font-semibold">Gastos Realizados</h3>
                        <p className="text-sm text-muted-foreground">Una lista de todos los gastos individuales registrados.</p>
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
                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(expense.amount)}
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
