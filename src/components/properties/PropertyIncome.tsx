
'use client';

import * as React from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, Pencil, Trash2 } from "lucide-react";
import { type Income, type Wallet, type IncomeCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddIncomeDialog } from './AddIncomeDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { incomeCategories } from '@/lib/data';

type PropertyIncomeProps = {
  propertyId: string;
  wallets: Wallet[];
};

export function PropertyIncome({ propertyId, wallets }: PropertyIncomeProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [incomes, setIncomes] = React.useState<Income[]>([]);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = React.useState(false);
  const [editingIncome, setEditingIncome] = React.useState<Income | null>(null);
  const [deletingIncomeId, setDeletingIncomeId] = React.useState<string | null>(null);

  const fetchIncomes = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const incomesCol = collection(db, 'properties', propertyId, 'incomes');
      const incomesSnapshot = await getDocs(incomesCol);
      const incomesList = incomesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          date: (doc.data().date as Timestamp).toDate().toISOString(),
      })) as Income[];
      
      incomesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setIncomes(incomesList);
    } catch (error) {
      console.error("Error fetching incomes:", error);
      toast({ title: "Error", description: "No se pudieron cargar los ingresos.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, toast]);

  React.useEffect(() => {
    fetchIncomes();
  }, [fetchIncomes]);

  const getSubcategoryName = (id: string) => {
    for (const category of incomeCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === id);
      if (subcategory) return subcategory.name;
    }
    return "Desconocido";
  };
  
  const getCategoryName = (subcategoryId: string) => {
    for (const category of incomeCategories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      if (subcategory) return category.name;
    }
    return "Desconocido";
  };

  const getWalletName = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? `${wallet.name} (${wallet.currency})` : "Desconocido";
  };
  
  const closeDialogs = () => {
    setIsAddIncomeOpen(false);
    setEditingIncome(null);
  };

  const handleIncomeSubmit = async (data: any) => {
    const incomeData = { ...data, date: Timestamp.fromDate(data.date) };
    try {
      if (editingIncome) {
        const incomeRef = doc(db, 'properties', propertyId, 'incomes', editingIncome.id);
        await updateDoc(incomeRef, incomeData);
        toast({ title: "Ingreso actualizado exitosamente" });
      } else {
        const incomesCol = collection(db, 'properties', propertyId, 'incomes');
        await addDoc(incomesCol, incomeData);
        toast({ title: "Ingreso añadido exitosamente" });
      }
      fetchIncomes();
      closeDialogs();
    } catch (error) {
      console.error("Error saving income:", error);
      toast({ title: "Error", description: "No se pudo guardar el ingreso.", variant: "destructive" });
    }
  };

  const handleEdit = (income: Income) => {
    setEditingIncome(income);
    setIsAddIncomeOpen(true);
  };

  const handleDelete = (incomeId: string) => {
    setDeletingIncomeId(incomeId);
  };

  const confirmDelete = async () => {
    if (deletingIncomeId) {
      try {
        const incomeRef = doc(db, 'properties', propertyId, 'incomes', deletingIncomeId);
        await deleteDoc(incomeRef);
        toast({ title: "Elemento eliminado", variant: "destructive" });
        setDeletingIncomeId(null);
        fetchIncomes();
      } catch (error) {
        console.error("Error deleting income:", error);
        toast({ title: "Error", description: "No se pudo eliminar el ingreso.", variant: "destructive" });
      }
    }
  };


  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
              <CardTitle>Ingresos</CardTitle>
              <Button onClick={() => { setEditingIncome(null); setIsAddIncomeOpen(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Ingreso
              </Button>
          </div>
        </CardHeader>
        <CardContent>
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
              {incomes.length > 0 ? incomes.map(income => (
                <TableRow key={income.id}>
                  <TableCell>{new Date(income.date).toLocaleDateString('es-ES')}</TableCell>
                  <TableCell>
                    <div className='font-medium'>{getSubcategoryName(income.subcategoryId)}</div>
                    <div className='text-xs text-muted-foreground'>{getCategoryName(income.subcategoryId)}</div>
                  </TableCell>
                  <TableCell>
                    {getWalletName(income.walletId)}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">{income.notes}</TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: income.currency }).format(income.amount)}
                  </TableCell>
                   <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(income)}>
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar Ingreso</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(income.id)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar Ingreso</span>
                          </Button>
                      </div>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay ingresos para mostrar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <AddIncomeDialog
        key={editingIncome ? `edit-${editingIncome.id}` : 'add'}
        isOpen={isAddIncomeOpen}
        onOpenChange={closeDialogs}
        wallets={wallets}
        incomeCategories={incomeCategories}
        onIncomeSubmit={handleIncomeSubmit}
        incomeToEdit={editingIncome}
      />

       <ConfirmDeleteDialog
        isOpen={!!deletingIncomeId}
        onOpenChange={() => setDeletingIncomeId(null)}
        onConfirm={confirmDelete}
        title="¿Estás seguro de que deseas eliminar este ingreso?"
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el ingreso de tus registros."
       />
    </>
  );
}
