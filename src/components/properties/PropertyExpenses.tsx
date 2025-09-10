
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type ExpectedExpense, type ActualExpense, type ExpenseCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type PropertyExpensesProps = {
  expectedExpenses: ExpectedExpense[];
  actualExpenses: ActualExpense[];
  expenseCategories: ExpenseCategory[];
};

export function PropertyExpenses({ expectedExpenses, actualExpenses, expenseCategories }: PropertyExpensesProps) {
  const { toast } = useToast();

  const getSubcategoryName = (id: string) => {
    for (const category of expenseCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return `${category.name} - ${subcategory.name}`;
    }
    return "Desconocido";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Gastos</CardTitle>
        <Button onClick={() => toast({ title: "Funcionalidad no implementada" })}>
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
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
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
  );
}
