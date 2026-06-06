
'use client';

import * as React from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, Pencil, Trash2, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { type Income, type Wallet, type IncomeCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { AddIncomeDialog } from './AddIncomeDialog';
import { ConfirmDeleteDialog } from '../shared/ConfirmDeleteDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { DateNavigator } from '../shared/DateNavigator';
import { SortableHeader, type SortConfig } from '../shared/SortableHeader';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

type PropertyIncomeProps = {
  propertyId: string;
  wallets: Wallet[];
  incomeCategories: IncomeCategory[];
  selectedMonth: string;
  selectedYear: string;
  incomes: Omit<Income, 'propertyId' | 'propertyName'>[];
  onTransactionUpdate: () => void;
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
};

export function PropertyIncome({ propertyId, wallets, incomeCategories, selectedMonth, selectedYear, incomes, onTransactionUpdate, currentDate, onDateChange }: PropertyIncomeProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAddIncomeOpen, setIsAddIncomeOpen] = React.useState(false);
  const [editingIncome, setEditingIncome] = React.useState<Omit<Income, 'propertyId' | 'propertyName'> | null>(null);
  const [deletingIncomeId, setDeletingIncomeId] = React.useState<string | null>(null);
  const [sortConfig, setSortConfig] = React.useState<SortConfig<any>>({ key: 'date', direction: 'desc' });


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

  const filteredIncomes = React.useMemo(() => {
    let incomeList = incomes.filter(income => {
        const incomeDate = new Date(income.date);
        const yearMatch = selectedYear === 'all' || incomeDate.getFullYear().toString() === selectedYear;
        const monthMatch = selectedMonth === 'all' || (incomeDate.getMonth() + 1).toString() === selectedMonth;
        return yearMatch && monthMatch;
    }).map(i => ({
        ...i,
        subcategoryName: getSubcategoryName(i.subcategoryId),
        categoryName: getCategoryName(i.subcategoryId),
        walletName: wallets.find(w => w.id === i.walletId)?.name || 'N/A'
    }));

    if (sortConfig) {
        incomeList.sort((a, b) => {
            const aValue = a[sortConfig.key as keyof typeof a];
            const bValue = b[sortConfig.key as keyof typeof b];
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return incomeList;
  }, [incomes, selectedMonth, selectedYear, sortConfig, getSubcategoryName, getCategoryName, wallets]);

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

  const handleEdit = (income: Omit<Income, 'propertyId' | 'propertyName'>) => {
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <CardTitle>Ingresos</CardTitle>
              <DateNavigator
                currentDate={currentDate}
                onDateChange={onDateChange}
              />
              <Button onClick={() => { setEditingIncome(null); setIsAddIncomeOpen(true); }} disabled={isLoading} className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Ingreso
              </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
          {isLoading ? (
            <div className="flex justify-center items-center h-24">
              <Loader className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
          <>
            <div className="space-y-2">
                <div className="flex items-center justify-end gap-2 my-4">
                    <Label htmlFor="sort-select-income" className="text-sm font-medium">Ordenar por:</Label>
                    <Select
                        value={sortConfig?.key}
                        onValueChange={(value) => setSortConfig({ key: value, direction: sortConfig?.direction || 'desc' })}
                    >
                        <SelectTrigger id="sort-select-income" className="w-auto h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
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
                                onClick={() => setSortConfig({ key: sortConfig?.key || 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
                            >
                                {sortConfig?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Cambiar orden</p></TooltipContent>
                    </Tooltip>
                </div>
              {filteredIncomes.length > 0 ? filteredIncomes.map(income => {
                 const wallet = wallets.find(w => w.id === income.walletId);
                 return (
                    <Card key={income.id} className="p-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-semibold">{income.subcategoryName}</p>
                                <p className="text-xs text-muted-foreground">{new Date(income.date).toLocaleDateString('es-ES')} | {wallet?.name}</p>
                            </div>
                            <div className={cn(
                                "font-bold text-lg",
                                {
                                    'text-green-600 dark:text-green-400': income.currency === 'USD',
                                    'text-blue-600 dark:text-blue-400': income.currency === 'ARS',
                                }
                            )}>
                                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: income.currency }).format(income.amount)}
                            </div>
                        </div>
                        {income.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{income.notes}</p>}
                        <div className="flex items-center justify-end gap-2 -mb-2 -mr-2 mt-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(income)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Editar ingreso</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(income.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Eliminar ingreso</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </Card>
                 )
              }) : (
                <div className="text-center text-muted-foreground py-10">
                    No hay ingresos para mostrar para el período seleccionado.
                </div>
              )}
            </div>
          </>
          )}
          </TooltipProvider>
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
