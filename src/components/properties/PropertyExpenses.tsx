
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddExpenseDialog } from './AddExpenseDialog';
import { AddExpectedExpenseDialog } from './AddExpectedExpenseDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type PropertyExpensesProps = {
  expectedExpenses: ExpectedExpense[];
  actualExpenses: ActualExpense[];
  expenseCategories: ExpenseCategory[];
};

export function PropertyExpenses({ expectedExpenses: initialExpectedExpenses, actualExpenses: initialActualExpenses, expenseCategories }: PropertyExpensesProps) {
  const { toast } = useToast();
  
  // State for Actual Expenses
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [actualExpenses, setActualExpenses] = React.useState<ActualExpense[]>(initialActualExpenses);
  const [editingExpense, setEditingExpense] = React.useState<ActualExpense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<string | null>(null);

  // State for Expected Expenses
  const [isAddExpectedExpenseOpen, setIsAddExpectedExpenseOpen] = React.useState(false);
  const [expectedExpenses, setExpectedExpenses] = React.useState<ExpectedExpense[]>(initialExpectedExpenses);
  const [editingExpectedExpense, setEditingExpectedExpense] = React.useState<ExpectedExpense | null>(null);
  const [deletingExpectedExpenseId, setDeletingExpectedExpenseId] = React.useState<string | null>(null);

  // State for filters
  const [selectedMonth, setSelectedMonth] = React.useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());

  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];

  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());


  const filteredExpectedExpenses = React.useMemo(() => {
    return expectedExpenses.filter(expense => {
      const expenseYear = expense.year.toString();
      const expenseMonth = expense.month.toString();
      const yearMatch = expenseYear === selectedYear;
      const monthMatch = selectedMonth === 'all' || expenseMonth === selectedMonth;
      return yearMatch && monthMatch;
    }).sort((a, b) => a.month - b.month);
  }, [expectedExpenses, selectedMonth, selectedYear]);


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
  const handleActualExpenseSubmit = (data: any) => {
    if (editingExpense) { // Editing existing expense
        const updatedExpense: ActualExpense = {
            ...editingExpense,
            ...data,
            date: data.date.toISOString(),
        };
        setActualExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? updatedExpense : exp));
        toast({ title: "Gasto actualizado exitosamente" });
    } else { // Adding new expense
        const newExpense: ActualExpense = {
            id: `act${Date.now()}`,
            propertyId: 'prop1', // This should be dynamic later
            ...data,
            date: data.date.toISOString(),
        };
        setActualExpenses(prev => [...prev, newExpense]);
        toast({ title: "Gasto añadido exitosamente" });
    }
    closeDialogs();
  }

  const handleEditActual = (expense: ActualExpense) => {
    setEditingExpense(expense);
    setIsAddExpenseOpen(true);
  };
  
  const handleDeleteActual = (expenseId: string) => {
    setDeletingExpenseId(expenseId);
  };

  const confirmDeleteActual = () => {
    if (deletingExpenseId) {
        setActualExpenses(prev => prev.filter(exp => exp.id !== deletingExpenseId));
        toast({ title: "Elemento eliminado", variant: "destructive" });
        setDeletingExpenseId(null);
    }
  }

  // --- Expected Expense Handlers ---
  const handleExpectedExpenseSubmit = (data: any) => {
      if(editingExpectedExpense) { // Editing existing expected expense
        const updatedExpense: ExpectedExpense = {
            ...editingExpectedExpense,
            ...data,
        };
        setExpectedExpenses(prev => prev.map(exp => exp.id === editingExpectedExpense.id ? updatedExpense : exp));
        toast({ title: "Gasto previsto actualizado exitosamente" });
      } else { // Adding new expected expense
        const newExpense: ExpectedExpense = {
            id: `exp${Date.now()}`,
            propertyId: 'prop1', // This should be dynamic later
            ...data,
        };
        setExpectedExpenses(prev => [...prev, newExpense]);
        toast({ title: "Gasto previsto añadido exitosamente" });
      }
      closeDialogs();
  }

  const handleEditExpected = (expense: ExpectedExpense) => {
    setEditingExpectedExpense(expense);
    setIsAddExpectedExpenseOpen(true);
  }

  const handleDeleteExpected = (expenseId: string) => {
    setDeletingExpectedExpenseId(expenseId);
  }

  const confirmDeleteExpected = () => {
    if (deletingExpectedExpenseId) {
        setExpectedExpenses(prev => prev.filter(exp => exp.id !== deletingExpectedExpenseId));
        toast({ title: "Elemento eliminado", variant: "destructive" });
        setDeletingExpectedExpenseId(null);
    }
  }


  // --- Dialog Management ---
  const closeDialogs = () => {
    setIsAddExpenseOpen(false);
    setEditingExpense(null);
    setIsAddExpectedExpenseOpen(false);
    setEditingExpectedExpense(null);
  }


  return (
    <>
        <Tabs defaultValue="overview">
        <div className='flex justify-between items-center mb-4'>
            <CardTitle>Gastos</CardTitle>
            <TabsList className="grid grid-cols-2 w-[300px]">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="actual">Historial</TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="overview">
            <Card>
                <CardHeader>
                    <div className='flex justify-between items-center'>
                        <div>
                            <CardTitle>Gastos Previstos</CardTitle>
                            <CardDescription>Una descripción general de tus gastos previstos y su estado.</CardDescription>
                        </div>
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
                            <Button onClick={() => { setEditingExpectedExpense(null); setIsAddExpectedExpenseOpen(true); }}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Añadir Gasto Previsto
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
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
                                        <Badge variant="outline" className='flex items-center gap-2'>
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
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                                No hay gastos previstos para mostrar para el período seleccionado.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="actual">
            <Card>
                <CardHeader>
                     <div className='flex justify-between items-center'>
                        <div>
                            <CardTitle>Historial de Gastos Reales</CardTitle>
                            <CardDescription>Una lista de todos los gastos individuales registrados.</CardDescription>
                        </div>
                        <Button onClick={() => { setEditingExpense(null); setIsAddExpenseOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Gasto Real
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {actualExpenses.length > 0 ? actualExpenses.map(expense => (
                            <TableRow key={expense.id}>
                            <TableCell>{new Date(expense.date).toLocaleDateString('es-ES')}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{`${getCategoryName(expense.subcategoryId)} - ${getSubcategoryName(expense.subcategoryId)}`}</Badge>
                            </TableCell>
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
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No hay gastos reales para mostrar.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
        </Tabs>
      
      {/* Dialog for Actual Expenses */}
      <AddExpenseDialog
        key={editingExpense ? `edit-${editingExpense.id}` : 'add'}
        isOpen={isAddExpenseOpen}
        onOpenChange={closeDialogs}
        expenseCategories={expenseCategories}
        onExpenseSubmit={handleActualExpenseSubmit}
        expenseToEdit={editingExpense}
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
