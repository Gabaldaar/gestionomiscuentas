
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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


  const getSubcategoryName = (id: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return `${category.name} - ${subcategory.name}`;
    }
    return "Desconocido";
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
      <Card>
        <CardHeader>
          <CardTitle>Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="actual">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="actual">Gastos Reales</TabsTrigger>
              <TabsTrigger value="expected">Gastos Previstos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="actual">
              <div className="flex justify-end py-4">
                 <Button onClick={() => { setEditingExpense(null); setIsAddExpenseOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Gasto Real
                </Button>
              </div>
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
                        <Badge variant="outline">{getSubcategoryName(expense.subcategoryId)}</Badge>
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
            </TabsContent>

            <TabsContent value="expected">
              <div className="flex justify-end py-4">
                 <Button onClick={() => { setEditingExpectedExpense(null); setIsAddExpectedExpenseOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Gasto Previsto
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expectedExpenses.length > 0 ? expectedExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.month}/{expense.year}</TableCell>
                      <TableCell>
                         <Badge variant="outline">{getSubcategoryName(expense.subcategoryId)}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(expense.amount)}
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
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No hay gastos previstos para mostrar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
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
