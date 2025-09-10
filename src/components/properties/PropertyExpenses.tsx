
'use client';

import * as React from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2, Loader } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory, type Wallet } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseDialog } from './AddExpenseDialog';
import { AddExpectedExpenseDialog } from './AddExpectedExpenseDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';

type PropertyExpensesProps = {
  propertyId: string;
  expenseCategories: ExpenseCategory[];
  wallets: Wallet[];
  selectedMonth: string;
  selectedYear: string;
};

export function PropertyExpenses({ propertyId, expenseCategories, wallets, selectedMonth, selectedYear }: PropertyExpensesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  
  // State for Actual Expenses
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [actualExpenses, setActualExpenses] = React.useState<ActualExpense[]>([]);
  const [editingExpense, setEditingExpense] = React.useState<ActualExpense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null);
  const [initialExpenseData, setInitialExpenseData] = React.useState<Partial<ActualExpense> | null>(null);


  // State for Expected Expenses
  const [isAddExpectedExpenseOpen, setIsAddExpectedExpenseOpen] = React.useState(false);
  const [expectedExpenses, setExpectedExpenses] = React.useState<ExpectedExpense[]>([]);
  const [editingExpectedExpense, setEditingExpectedExpense] = React.useState<ExpectedExpense | null>(null);
  const [deletingExpectedExpenseId, setDeletingExpectedExpenseId] = React.useState<string | null>(null);

  const fetchExpenses = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch actual expenses
      const actualExpensesCol = collection(db, 'properties', propertyId, 'actualExpenses');
      const actualExpensesSnapshot = await getDocs(actualExpensesCol);
      const actualExpensesList = actualExpensesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: (doc.data().date as Timestamp).toDate().toISOString(),
      })) as ActualExpense[];
      setActualExpenses(actualExpensesList);

      // Fetch expected expenses
      const expectedExpensesCol = collection(db, 'properties', propertyId, 'expectedExpenses');
      const expectedExpensesSnapshot = await getDocs(expectedExpensesCol);
      const expectedExpensesList = expectedExpensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ExpectedExpense[];
      setExpectedExpenses(expectedExpensesList);

    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({ title: "Error", description: "No se pudieron cargar los gastos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, toast]);

  React.useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

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
    const expenseData = { ...data, date: Timestamp.fromDate(data.date) };
    try {
        if (editingExpense) { // Editing existing expense
            const expenseRef = doc(db, 'properties', propertyId, 'actualExpenses', editingExpense.id);
            await updateDoc(expenseRef, expenseData);
            toast({ title: "Gasto actualizado exitosamente" });
        } else { // Adding new expense
            const expensesCol = collection(db, 'properties', propertyId, 'actualExpenses');
            await addDoc(expensesCol, expenseData);
            toast({ title: "Gasto añadido exitosamente" });
        }
        fetchExpenses();
        closeDialogs();
    } catch(error) {
        console.error("Error saving actual expense:", error);
        toast({ title: "Error", description: "No se pudo guardar el gasto.", variant: "destructive" });
    }
  }

  const handleAddActualFromExpected = (expense: ExpectedExpense) => {
    setInitialExpenseData({
        subcategoryId: expense.subcategoryId,
        amount: expense.amount,
        currency: expense.currency,
        date: new Date(expense.year, expense.month - 1, 1).toISOString(),
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
    if (deletingExpenseId) {
        try {
            const expenseRef = doc(db, 'properties', propertyId, 'actualExpenses', deletingExpenseId);
            await deleteDoc(expenseRef);
            toast({ title: "Elemento eliminado", variant: "destructive" });
            setDeletingExpenseId(null);
            fetchExpenses();
        } catch(error) {
            console.error("Error deleting actual expense:", error);
            toast({ title: "Error", description: "No se pudo eliminar el gasto.", variant: "destructive" });
        }
    }
  }

  // --- Expected Expense Handlers ---
  const handleExpectedExpenseSubmit = async (data: any) => {
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
      fetchExpenses();
      closeDialogs();
    } catch(error) {
        console.error("Error saving expected expense:", error);
        toast({ title: "Error", description: "No se pudo guardar el gasto previsto.", variant: "destructive" });
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
        try {
            const expenseRef = doc(db, 'properties', propertyId, 'expectedExpenses', deletingExpectedExpenseId);
            await deleteDoc(expenseRef);
            toast({ title: "Elemento eliminado", variant: "destructive" });
            setDeletingExpectedExpenseId(null);
            fetchExpenses();
        } catch(error) {
            console.error("Error deleting expected expense:", error);
            toast({ title: "Error", description: "No se pudo eliminar el gasto previsto.", variant: "destructive" });
        }
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
            <TabsList className="grid grid-cols-2 w-[300px]">
              <TabsTrigger value="overview">Presupuesto</TabsTrigger>
              <TabsTrigger value="actual">Gastos</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="overview">
                <div className='flex justify-between items-center mb-4'>
                    <div>
                        <h3 className="text-lg font-semibold">Gastos Previstos</h3>
                        <p className="text-sm text-muted-foreground">Una descripción general de tus gastos previstos y su estado.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => { setEditingExpectedExpense(null); setIsAddExpectedExpenseOpen(true); }}>
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
                        <TableHead className="text-right">Pagado</TableHead>
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
                                <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(expense.amount)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
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
                        <Button onClick={() => { setEditingExpense(null); setInitialExpenseData(null); setIsAddExpenseOpen(true); }}>
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
                        <TableHead>Billetera</TableHead>
                        <TableHead>Notas</TableHead>
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
                        <TableCell>{getWalletName(expense.walletId)}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{expense.notes}</TableCell>
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
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el gasto de tus registros."
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
    </>
  );
}

    
