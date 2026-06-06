
'use client';

import * as React from 'react';
import { collection, collectionGroup, getDocs, query, where, Timestamp, orderBy, doc, writeBatch, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader, AlertTriangle, Filter, X, CalendarClock, Tag, Building, Pencil, Trash2, ReceiptText, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { type ExpectedExpense, type ActualExpense, type Property, type ExpenseCategory, type Currency, type Wallet, type ExpenseSubcategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddExpectedExpenseDialog } from '@/components/properties/AddExpectedExpenseDialog';
import { AddExpenseDialog } from '@/components/properties/AddExpenseDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SortableHeader, type SortConfig } from '@/components/shared/SortableHeader';
import { Label } from '@/components/ui/label';
import { useAccount } from '@/components/context/AccountProvider';

type ExpectedExpenseWithDetails = ExpectedExpense & { propertyName: string; propertyId: string; date: Date; paidAmount: number; balance: number; categoryName: string; subcategoryName: string; };

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

export default function DueDatesPage() {
  const { toast } = useToast();
  const { activeAccountId } = useAccount();

  const [allExpectedExpenses, setAllExpectedExpenses] = React.useState<ExpectedExpenseWithDetails[]>([]);
  const [allActualExpenses, setAllActualExpenses] = React.useState<ActualExpense[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Filter states
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [daysFilter, setDaysFilter] = React.useState<string>('all');
  const [sortConfig, setSortConfig] = React.useState<SortConfig<ExpectedExpenseWithDetails>>({ key: 'date', direction: 'asc' });

  // Dialog states
  const [editingExpected, setEditingExpected] = React.useState<ExpectedExpenseWithDetails | null>(null);
  const [deletingExpected, setDeletingExpected] = React.useState<ExpectedExpenseWithDetails | null>(null);
  const [payingExpected, setPayingExpected] = React.useState<ExpectedExpenseWithDetails | null>(null);

  const getCategoryInfo = React.useCallback((subcategoryId: string, cats: ExpenseCategory[]) => {
    for (const cat of cats) {
      const subcat = cat.subcategories.find(s => s.id === subcategoryId);
      if (subcat) return { categoryName: cat.name, subcategoryName: subcat.name };
    }
    return { categoryName: 'N/A', subcategoryName: 'N/A' };
  }, []);

  const fetchAllData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [propsSnap, expectedExpensesSnap, actualExpensesSnap, categoriesSnap, walletsSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), orderBy('name'))),
        getDocs(query(collectionGroup(db, 'expectedExpenses'))),
        getDocs(query(collectionGroup(db, 'actualExpenses'))),
        getDocs(query(collection(db, 'expenseCategories'), orderBy('name'))),
        getDocs(query(collection(db, 'wallets'))),
      ]);

      const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      const propsMap = new Map(propsList.map(p => [p.id, p.name]));
      setProperties(propsList);

      setWallets(walletsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet)));
      
      const actualsList = actualExpensesSnap.docs.map(doc => {
          const data = doc.data();
          const propertyId = doc.ref.parent.parent!.id;
          let date;
          if (data.date instanceof Timestamp) {
            date = data.date.toDate();
          } else if (typeof data.date === 'string') {
            date = new Date(data.date);
          } else {
            date = new Date();
          }
          return {id: doc.id, ...data, date, propertyId} as ActualExpense & {date: Date};
      });
      setAllActualExpenses(actualsList);
      
      const categoriesList = await Promise.all(categoriesSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as ExpenseSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as ExpenseCategory;
      }));
      setCategories(categoriesList);

      const expectedList = expectedExpensesSnap.docs
        .map(doc => {
            const data = doc.data();
            const propertyId = doc.ref.parent.parent!.id;
            
            let expenseDate: Date;
            if (data.date instanceof Timestamp) {
                expenseDate = data.date.toDate();
            } else if (typeof data.date === 'string') {
                expenseDate = new Date(data.date);
            } else {
                const year = (data as any).year || new Date().getFullYear();
                const month = (data as any).month ? (data as any).month - 1 : new Date().getMonth();
                expenseDate = new Date(year, month, 5);
            }

            const { categoryName, subcategoryName } = getCategoryInfo(data.subcategoryId, categoriesList);

            const typedData = {
              id: doc.id,
              ...data,
              date: expenseDate,
              propertyId: propertyId,
              propertyName: propsMap.get(propertyId) || 'Cuenta Desconocida',
              categoryName,
              subcategoryName,
            } as ExpectedExpenseWithDetails;
            
            const paidAmount = actualsList.filter(a => {
                const actualDate = a.date;
                return a.propertyId === typedData.propertyId && 
                       a.subcategoryId === typedData.subcategoryId && 
                       actualDate.getFullYear() === expenseDate.getFullYear() && 
                       actualDate.getMonth() === expenseDate.getMonth() && 
                       a.currency === typedData.currency;
            }).reduce((sum, current) => sum + current.amount, 0);

            return {
                ...typedData,
                paidAmount,
                balance: typedData.amount - paidAmount
            };
        })
        .filter(expense => !expense.isPaid && expense.balance > 0.009);

      setAllExpectedExpenses(expectedList);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError('No se pudo cargar la información de vencimientos. Por favor, inténtalo de nuevo.');
      toast({ title: 'Error', description: 'No se pudo cargar la información.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, getCategoryInfo]);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Filter Logic ---
  const handleClearFilters = () => {
    setSelectedCategory('all');
    setDaysFilter('all');
  };

  const areFiltersActive = React.useMemo(() => {
    return selectedCategory !== 'all' || daysFilter !== 'all';
  }, [selectedCategory, daysFilter]);

  const sortedAndFilteredExpenses = React.useMemo(() => {
    let filtered = allExpectedExpenses.filter(expense => {
      let match = true;
      const expenseDate = expense.date; 
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (activeAccountId !== 'all' && expense.propertyId !== activeAccountId) match = false;

      if (daysFilter !== 'all') {
        if (daysFilter === 'overdue') {
            if (expenseDate >= today) match = false;
        } else {
            const limitDate = addDays(today, parseInt(daysFilter));
            if (expenseDate > limitDate || expenseDate < today) match = false;
        }
      }
      
      if (selectedCategory !== 'all') {
        const category = categories.find(c => c.id === selectedCategory);
        const subcategoryIds = category?.subcategories.map(s => s.id) || [];
        if (!subcategoryIds.includes(expense.subcategoryId)) {
          match = false;
        }
      }
      
      return match;
    });

    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;

  }, [allExpectedExpenses, activeAccountId, daysFilter, categories, sortConfig]);

  // --- Action Handlers ---
  const handleToggleIsPaid = async (expense: ExpectedExpenseWithDetails) => {
      setIsSubmitting(true);
      try {
          const expenseRef = doc(db, 'properties', expense.propertyId, 'expectedExpenses', expense.id);
          await updateDoc(expenseRef, { isPaid: !expense.isPaid });
          toast({ title: "Estado de pago actualizado" });
          fetchAllData();
      } catch (error) {
          toast({ title: "Error", description: "No se pudo actualizar el estado de pago.", variant: "destructive"});
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleExpectedSubmit = async (data: any) => {
      if (!editingExpected) return;
      setIsSubmitting(true);
      try {
          const expenseRef = doc(db, 'properties', editingExpected.propertyId, 'expectedExpenses', editingExpected.id);
          await updateDoc(expenseRef, {...data, date: Timestamp.fromDate(data.date)});
          toast({ title: "Gasto previsto actualizado" });
          setEditingExpected(null);
          fetchAllData();
      } catch (e) {
          toast({ title: "Error", description: "No se pudo actualizar el gasto.", variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  }
  
  const handleActualSubmit = async (data: any) => {
      if (!payingExpected) return;
      setIsSubmitting(true);
      const batch = writeBatch(db);
      try {
          const expenseRef = doc(collection(db, 'properties', payingExpected.propertyId, 'actualExpenses'));
          const walletRef = doc(db, 'wallets', data.walletId);
          
          const walletSnap = await getDoc(walletRef);
          if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
          
          const walletData = walletSnap.data() as Wallet;
          if (walletData.balance < data.amount && !walletData.allowNegativeBalance) {
               throw new Error(`Fondos insuficientes en ${walletData.name}.`);
          }
          batch.update(walletRef, { balance: walletData.balance - data.amount });
          batch.set(expenseRef, { ...data, date: Timestamp.fromDate(data.date), propertyId: payingExpected.propertyId });
          
          const totalPaid = payingExpected.paidAmount + data.amount;
          if (totalPaid >= payingExpected.amount) {
              const expectedRef = doc(db, 'properties', payingExpected.propertyId, 'expectedExpenses', payingExpected.id);
              batch.update(expectedRef, { isPaid: true });
          }

          await batch.commit();
          toast({ title: "Pago registrado exitosamente" });
          setPayingExpected(null);
          fetchAllData();

      } catch (e) {
          const msg = e instanceof Error ? e.message : "No se pudo registrar el pago.";
          toast({ title: "Error", description: msg, variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  }

  const handleDelete = async () => {
    if (!deletingExpected) return;
    setIsSubmitting(true);
    try {
      const expenseRef = doc(db, 'properties', deletingExpected.propertyId, 'expectedExpenses', deletingExpected.id);
      await deleteDoc(expenseRef);
      toast({ title: "Gasto previsto eliminado", variant: 'destructive' });
      setDeletingExpected(null);
      fetchAllData();
    } catch (e) {
      toast({ title: "Error", description: "No se pudo eliminar el gasto.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader><CardTitle className='text-destructive flex items-center gap-2'><AlertTriangle/> Error</CardTitle></CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchAllData} className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Próximos Vencimientos" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Filter className="h-5 w-5"/> Filtros</div>
            {areFiltersActive && <Button variant="ghost" size="sm" onClick={handleClearFilters}><X className="mr-2 h-4 w-4"/>Limpiar Filtros</Button>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-4">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Vence en..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquier fecha</SelectItem>
              <SelectItem value="overdue">Vencidos</SelectItem>
              <SelectItem value="7">Próximos 7 días</SelectItem>
              <SelectItem value="15">Próximos 15 días</SelectItem>
              <SelectItem value="30">Próximos 30 días</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {areFiltersActive && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Filtros Aplicados</AlertTitle>
          <AlertDescription>
            Los resultados que se muestran a continuación están filtrados.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lista de Vencimientos</CardTitle>
          <CardDescription>Se encontraron {sortedAndFilteredExpenses.length} vencimientos sin pagar con los filtros aplicados.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="Vencimiento" sortKey="date" sortConfig={sortConfig} onSort={setSortConfig} />
                  <SortableHeader label="Cuenta" sortKey="propertyName" sortConfig={sortConfig} onSort={setSortConfig} />
                  <SortableHeader label="Categoría" sortKey="categoryName" sortConfig={sortConfig} onSort={setSortConfig} />
                  <SortableHeader label="Total Previsto" sortKey="amount" sortConfig={sortConfig} onSort={setSortConfig} className="text-right" />
                  <TableHead className="text-right">Pagado</TableHead>
                  <SortableHeader label="Saldo" sortKey="balance" sortConfig={sortConfig} onSort={setSortConfig} className="text-right" />
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredExpenses.length > 0 ? sortedAndFilteredExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{format(expense.date, 'dd/MM/yyyy', { locale: es })}</TableCell>
                      <TableCell>
                        <Link href={`/properties/${expense.propertyId}`} className="hover:underline text-blue-600 dark:text-blue-400">
                          {expense.propertyName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{expense.subcategoryName}</div>
                        <div className="text-xs text-muted-foreground">{expense.categoryName}</div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(expense.amount, expense.currency)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(expense.paidAmount, expense.currency)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatCurrency(expense.balance, expense.currency)}</TableCell>
                      <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => handleToggleIsPaid(expense)}><CheckCircle className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" onClick={() => setPayingExpected(expense)}><ReceiptText className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingExpected(expense)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingExpected(expense)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                      </TableCell>
                    </TableRow>
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">No se encontraron vencimientos para los filtros seleccionados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-4">
              <div className="flex items-center justify-end gap-2 my-4">
                <Label htmlFor="sort-select-due-dates" className="text-sm font-medium">Ordenar por:</Label>
                <Select
                    value={sortConfig?.key as string}
                    onValueChange={(value) => setSortConfig({ key: value as keyof ExpectedExpenseWithDetails, direction: sortConfig?.direction || 'asc' })}
                >
                    <SelectTrigger id="sort-select-due-dates" className="w-auto h-9"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date">Fecha</SelectItem>
                        <SelectItem value="balance">Saldo</SelectItem>
                        <SelectItem value="subcategoryName">Categoría</SelectItem>
                        <SelectItem value="propertyName">Cuenta</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant="outline" size="icon" className="h-9 w-9"
                    onClick={() => setSortConfig({ key: sortConfig?.key || 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' })}
                >
                    {sortConfig?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              </div>
            {sortedAndFilteredExpenses.length > 0 ? sortedAndFilteredExpenses.map(expense => {
              return (
                <Card key={expense.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 space-y-1">
                      <p className="font-semibold">{expense.subcategoryName}</p>
                       <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        <span>{expense.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building className="h-3 w-3" />
                          <Link href={`/properties/${expense.propertyId}`} className="hover:underline">
                            {expense.propertyName}
                          </Link>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-semibold">
                          <CalendarClock className="h-4 w-4" />
                          <span>{format(expense.date, 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                     <div className="flex flex-col items-end">
                       <p className="font-bold text-lg text-destructive">{formatCurrency(expense.balance, expense.currency)}</p>
                       <p className="text-xs text-muted-foreground">de {formatCurrency(expense.amount, expense.currency)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end -mr-2 border-t mt-2 pt-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleToggleIsPaid(expense)}><CheckCircle className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => setPayingExpected(expense)}><ReceiptText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingExpected(expense)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeletingExpected(expense)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Card>
              )
            }) : (
              <div className="text-center text-muted-foreground py-10">
                No se encontraron vencimientos para los filtros seleccionados.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>

    {editingExpected && (
      <AddExpectedExpenseDialog
        isOpen={!!editingExpected}
        onOpenChange={() => setEditingExpected(null)}
        expenseCategories={categories}
        onExpenseSubmit={handleExpectedSubmit}
        expenseToEdit={editingExpected}
      />
    )}

    {payingExpected && (
      <AddExpenseDialog
        isOpen={!!payingExpected}
        onOpenChange={() => setPayingExpected(null)}
        expenseCategories={categories}
        wallets={wallets.filter(w => w.currency === payingExpected.currency)}
        onExpenseSubmit={handleActualSubmit}
        isSubmitting={isSubmitting}
        initialData={{
            subcategoryId: payingExpected.subcategoryId,
            amount: payingExpected.balance > 0 ? payingExpected.balance : 0,
            currency: payingExpected.currency,
            date: payingExpected.date,
        }}
        title="Registrar Pago de Vencimiento"
        description={`Registrando pago para "${payingExpected.subcategoryName}" en la cuenta "${payingExpected.propertyName}"`}
      />
    )}

    <ConfirmDeleteDialog
      isOpen={!!deletingExpected}
      onOpenChange={() => setDeletingExpected(null)}
      onConfirm={handleDelete}
      title="¿Eliminar Gasto Previsto?"
      description="Esta acción eliminará permanentemente el gasto previsto. No afectará a los gastos reales ya registrados. ¿Estás seguro?"
    />

    </>
  );
}
