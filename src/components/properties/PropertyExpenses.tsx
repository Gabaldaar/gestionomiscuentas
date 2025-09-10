
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

type PropertyExpensesProps = {
  expectedExpenses: ExpectedExpense[];
  actualExpenses: ActualExpense[];
  expenseCategories: ExpenseCategory[];
};

export function PropertyExpenses({ expectedExpenses, actualExpenses: initialActualExpenses, expenseCategories }: PropertyExpensesProps) {
  const { toast } = useToast();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = React.useState(false);
  const [actualExpenses, setActualExpenses] = React.useState<ActualExpense[]>(initialActualExpenses);

  const getSubcategoryName = (id: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return `${category.name} - ${subcategory.name}`;
    }
    return "Desconocido";
  };

  const handleExpenseAdded = (data: any) => {
    const newExpense: ActualExpense = {
        id: `act${actualExpenses.length + 1}`,
        propertyId: 'prop1', // This should be dynamic later
        subcategoryId: data.subcategoryId,
        amount: data.amount,
        currency: data.currency,
        date: data.date.toISOString(),
        notes: data.notes || '',
    };
    setActualExpenses(prev => [...prev, newExpense]);
    toast({ title: "Gasto añadido exitosamente" });
    setIsAddExpenseOpen(false);
  }

  const handleEdit = () => {
    toast({ title: "Funcionalidad no implementada" });
  };

  const handleDelete = () => {
    toast({ title: "Elemento eliminado", variant: "destructive" });
  };


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gastos</CardTitle>
          <Button onClick={() => setIsAddExpenseOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Gasto
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="actual">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="actual">Gastos Reales</TabsTrigger>
              <TabsTrigger value="expected">Gastos Previstos</TabsTrigger>
            </TabsList>
            <TabsContent value="actual">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEdit}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Editar Gasto</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleDelete}>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
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
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
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
    <AddExpenseDialog
      isOpen={isAddExpenseOpen}
      onOpenChange={setIsAddExpenseOpen}
      expenseCategories={expenseCategories}
      onExpenseAdded={handleExpenseAdded}
    />
    </>
  );
}
