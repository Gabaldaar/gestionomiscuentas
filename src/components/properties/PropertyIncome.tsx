
'use client';

import * as React from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, Pencil, Trash2, FileText } from "lucide-react";
import { type Income, type Wallet, type IncomeCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddIncomeDialog } from './AddIncomeDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type PropertyIncomeProps = {
  propertyId: string;
  wallets: Wallet[];
  incomeCategories: IncomeCategory[];
  selectedMonth: string;
  selectedYear: string;
  incomes: Income[];
  onTransactionUpdate: () => void;
};

export function PropertyIncome({ propertyId, wallets, incomeCategories, selectedMonth, selectedYear, incomes, onTransactionUpdate }: PropertyIncomeProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = React.useState(false);
  const [editingIncome, setEditingIncome] = React.useState<Income | null>(null);
  const [deletingIncomeId, setDeletingIncomeId] = React.useState<string | null>(null);

  const filteredIncomes = React.useMemo(() => {
    return incomes.filter(income => {
        const incomeDate = new Date(income.date);
        const yearMatch = selectedYear === 'all' || incomeDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (incomeDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [incomes, selectedMonth, selectedYear]);

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

  const closeDialogs = () => {
    setIsAddIncomeOpen(false);
    setEditingIncome(null);
  };

  const handleIncomeSubmit = async (data: any) => {
    const batch = writeBatch(db);
    setIsLoading(true);

    try {
      if (editingIncome) {
        // --- Editing existing income ---
        const incomeRef = doc(db, 'properties', propertyId, 'incomes', editingIncome.id);
        const oldWalletRef = doc(db, 'wallets', editingIncome.walletId);
        const newWalletRef = doc(db, 'wallets', data.walletId);
        
        const oldWalletSnap = await getDoc(oldWalletRef);
        if (!oldWalletSnap.exists()) throw new Error("La billetera original no fue encontrada.");
        const oldWalletData = oldWalletSnap.data() as Wallet;

        // Revert old amount from its wallet
        const revertedBalance = oldWalletData.balance - editingIncome.amount;

        if (editingIncome.walletId === data.walletId) {
            // If wallet is the same, just update the balance with the new amount
            batch.update(newWalletRef, { balance: revertedBalance + data.amount });
        } else {
            // If wallet has changed, update old wallet and new wallet separately
            batch.update(oldWalletRef, { balance: revertedBalance });
            
            const newWalletSnap = await getDoc(newWalletRef);
            if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
            const newWalletData = newWalletSnap.data() as Wallet;
            batch.update(newWalletRef, { balance: newWalletData.balance + data.amount });
        }

        batch.update(incomeRef, { ...data, date: Timestamp.fromDate(data.date) });
        toast({ title: "Ingreso actualizado exitosamente" });

      } else {
        // --- Adding new income ---
        const incomeRef = doc(collection(db, 'properties', propertyId, 'incomes'));
        const walletRef = doc(db, 'wallets', data.walletId);

        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
        
        const walletData = walletSnap.data() as Wallet;
        const newBalance = walletData.balance + data.amount;

        batch.update(walletRef, { balance: newBalance });
        batch.set(incomeRef, { ...data, date: Timestamp.fromDate(data.date) });
        
        toast({ title: "Ingreso añadido exitosamente" });
      }
      
      await batch.commit();
      onTransactionUpdate();
      closeDialogs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el ingreso.";
      console.error("Error saving income:", error);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsLoading(false);
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
    if (!deletingIncomeId) return;

    const incomeToDelete = incomes.find(i => i.id === deletingIncomeId);
    if (!incomeToDelete) {
        toast({ title: "Error", description: "No se encontró el ingreso a eliminar.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const batch = writeBatch(db);
    const incomeRef = doc(db, 'properties', propertyId, 'incomes', deletingIncomeId);
    const walletRef = doc(db, 'wallets', incomeToDelete.walletId);
    
    try {
        const walletSnap = await getDoc(walletRef);
        if (walletSnap.exists()) {
            const walletData = walletSnap.data() as Wallet;
            const newBalance = walletData.balance - incomeToDelete.amount;
            batch.update(walletRef, { balance: newBalance });
        }
        
        batch.delete(incomeRef);
        await batch.commit();

        toast({ title: "Elemento eliminado", variant: "destructive" });
        setDeletingIncomeId(null);
        onTransactionUpdate();
    } catch (error) {
        console.error("Error deleting income:", error);
        toast({ title: "Error", description: "No se pudo eliminar el ingreso.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-row items-center justify-between">
              <CardTitle>Ingresos</CardTitle>
              <Button onClick={() => { setEditingIncome(null); setIsAddIncomeOpen(true); }} disabled={isLoading}>
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
                <TableHead className="hidden md:table-cell">Billetera</TableHead>
                <TableHead className="hidden md:table-cell">Notas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncomes.length > 0 ? filteredIncomes.map(income => {
                 const wallet = wallets.find(w => w.id === income.walletId);
                 return (
                <TableRow key={income.id}>
                  <TableCell>{new Date(income.date).toLocaleDateString('es-ES')}</TableCell>
                  <TableCell>
                    <div className='font-medium'>{getSubcategoryName(income.subcategoryId)}</div>
                    <div className='text-xs text-muted-foreground'>{getCategoryName(income.subcategoryId)}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                     {wallet ? (
                      <span>
                        {wallet.name}{' '}
                        <span className={cn('font-semibold', {
                          'text-green-800 dark:text-green-400': wallet.currency === 'USD',
                          'text-blue-800 dark:text-blue-400': wallet.currency === 'ARS',
                        })}>
                          ({wallet.currency})
                        </span>
                      </span>
                    ) : (
                      "Desconocido"
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {income.notes ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <p className="text-sm">{income.notes}</p>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-medium",
                    {
                        'text-green-800 dark:text-green-400': income.currency === 'USD',
                        'text-blue-800 dark:text-blue-400': income.currency === 'ARS',
                    }
                  )}>
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
                 )
                }) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No hay ingresos para mostrar para el período seleccionado.
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
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el ingreso y revertirá el monto en la billetera asociada."
       />
    </>
  );
}

    