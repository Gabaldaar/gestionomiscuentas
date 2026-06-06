
'use client';

import * as React from 'react';
import { collection, getDocs, Timestamp, query, collectionGroup, doc, writeBatch, getDoc, where, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader, AlertTriangle, Filter, FileText, X, TrendingDown, Wallet, Pencil, Trash2, ArrowUp, ArrowDown, PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
import { type ActualExpense, type Property, type ExpenseCategory, type Currency, type Wallet as WalletType, Liability, type ExpenseSubcategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddExpenseDialog, type ExpenseFormValues } from '@/components/properties/AddExpenseDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SortableHeader, type SortConfig } from '@/components/shared/SortableHeader';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { useAccount } from '@/components/context/AccountProvider';


const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

// Extends ActualExpense to include propertyName for easier display
type ExpenseWithDetails = ActualExpense & { propertyName: string, categoryName: string, subcategoryName: string, walletName: string };

export default function ExpensesPage() {
    const { toast } = useToast();
    const { activeAccountId } = useAccount();

    const [allExpenses, setAllExpenses] = React.useState<ExpenseWithDetails[]>([]);
    const [properties, setProperties] = React.useState<Property[]>([]);
    const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
    const [wallets, setWallets] = React.useState<WalletType[]>([]);
    const [liabilities, setLiabilities] = React.useState<Liability[]>([]);
    
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filter states
    const [date, setDate] = React.useState<DateRange | undefined>({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
    const [selectedCategory, setSelectedCategory] = React.useState('all');
    const [selectedSubcategory, setSelectedSubcategory] = React.useState('all');
    const [selectedCurrency, setSelectedCurrency] = React.useState<Currency | 'all'>('all');
    const [selectedWallet, setSelectedWallet] = React.useState('all');
    const [sortConfig, setSortConfig] = React.useState<SortConfig<ExpenseWithDetails>>({ key: 'date', direction: 'desc' });


    // Dialog State
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [editingExpense, setEditingExpense] = React.useState<ExpenseWithDetails | null>(null);
    const [deletingExpense, setDeletingExpense] = React.useState<ExpenseWithDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    
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
            const [propsSnap, walletsSnap, expensesSnap, categoriesSnap, liabilitiesSnap] = await Promise.all([
                getDocs(query(collection(db, 'properties'))),
                getDocs(query(collection(db, 'wallets'))),
                getDocs(query(collectionGroup(db, 'actualExpenses'))),
                getDocs(query(collection(db, 'expenseCategories'), orderBy('name'))),
                getDocs(query(collection(db, 'liabilities'))),
            ]);

            const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
            const propsMap = new Map(propsList.map(p => [p.id, p.name]));
            setProperties(propsList);
            
            const walletsList = walletsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletType));
            const walletsMap = new Map(walletsList.map(w => [w.id, w.name]));
            setWallets(walletsList);

            const liabilitiesList = liabilitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Liability));
            setLiabilities(liabilitiesList);

            const categoriesList = await Promise.all(categoriesSnap.docs.map(async (categoryDoc) => {
                const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
                const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
                const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as ExpenseSubcategory));
                return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as ExpenseCategory;
            }));
            setCategories(categoriesList);

            const expensesList = expensesSnap.docs.map(doc => {
                const data = doc.data() as ActualExpense;
                const propertyId = doc.ref.parent.parent!.id;
                const { categoryName, subcategoryName } = getCategoryInfo(data.subcategoryId, categoriesList);
                return {
                    id: doc.id,
                    ...data,
                    date: (data.date as unknown as Timestamp).toDate().toISOString(),
                    propertyId: propertyId,
                    propertyName: propsMap.get(propertyId) || 'Cuenta Desconocida',
                    categoryName,
                    subcategoryName,
                    walletName: walletsMap.get(data.walletId) || 'N/A'
                } as ExpenseWithDetails;
            });
            setAllExpenses(expensesList);

        } catch (err) {
            console.error("Error fetching data:", err);
            setError('No se pudo cargar la información. Por favor, inténtalo de nuevo.');
            toast({ title: 'Error', description: 'No se pudo cargar la información.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast, getCategoryInfo]);

    React.useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleEditClick = (expense: ExpenseWithDetails) => {
        setEditingExpense(expense);
        setIsEditDialogOpen(true);
    };

    const handleDeleteClick = (expense: ExpenseWithDetails) => {
        setDeletingExpense(expense);
    };
    
    const handleAddExpenseSubmit = async (data: ExpenseFormValues) => {
        if (!data.propertyId) {
            toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el gasto.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const batch = writeBatch(db);

        try {
            const expenseRef = doc(collection(db, 'properties', data.propertyId, 'actualExpenses'));
            const walletRef = doc(db, 'wallets', data.walletId);
            
            const walletSnap = await getDoc(walletRef);
            if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
            
            const walletData = walletSnap.data() as WalletType;
            if (walletData.balance < data.amount && !walletData.allowNegativeBalance) {
                 throw new Error(`Fondos insuficientes en ${walletData.name}.`);
            }
            batch.update(walletRef, { balance: walletData.balance - data.amount });
            
            const expenseData: any = { ...data, date: Timestamp.fromDate(data.date) };
            if (expenseData.liabilityId === 'none' || !expenseData.liabilityId) {
                delete expenseData.liabilityId;
            }

            batch.set(expenseRef, expenseData);

            if (expenseData.liabilityId) {
                const liabilityRef = doc(db, 'liabilities', expenseData.liabilityId);
                const liabilitySnap = await getDoc(liabilityRef);
                if (liabilitySnap.exists()) {
                    const liabilityData = liabilitySnap.data() as Liability;
                    batch.update(liabilityRef, { outstandingBalance: liabilityData.outstandingBalance - expenseData.amount });

                    const paymentRef = doc(collection(db, 'liabilities', expenseData.liabilityId, 'payments'));
                    const paymentData = {
                        liabilityId: expenseData.liabilityId,
                        date: Timestamp.fromDate(expenseData.date),
                        amount: expenseData.amount,
                        walletId: expenseData.walletId,
                        currency: expenseData.currency,
                        notes: `Pago registrado desde Historial de Gastos`,
                        actualExpenseId: expenseRef.id,
                        propertyId: expenseData.propertyId,
                    };
                    batch.set(paymentRef, paymentData);
                }
            }
            
            await batch.commit();
            toast({ title: "Gasto añadido exitosamente" });
            setIsAddDialogOpen(false);
            fetchAllData();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "No se pudo registrar el gasto.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleUpdateExpenseSubmit = async (data: ExpenseFormValues) => {
        if (!editingExpense || !data.propertyId) return;
        setIsSubmitting(true);
        
        const batch = writeBatch(db);
        const originalPropertyId = editingExpense.propertyId;
        const newPropertyId = data.propertyId;

        const { propertyId, ...restOfData } = data;
        const dataToSave: any = { ...restOfData, date: Timestamp.fromDate(data.date) };
        if (dataToSave.liabilityId === 'none' || !dataToSave.liabilityId) {
            delete dataToSave.liabilityId;
        }

        try {
            // Revert original transaction from original wallet
            const oldWalletRef = doc(db, 'wallets', editingExpense.walletId);
            const oldWalletSnap = await getDoc(oldWalletRef);
            if (!oldWalletSnap.exists()) throw new Error("La billetera original no fue encontrada.");
            const oldWalletData = oldWalletSnap.data() as WalletType;
            batch.update(oldWalletRef, { balance: oldWalletData.balance + editingExpense.amount });

            // If property has changed, delete old and create new. Otherwise, update.
            if (originalPropertyId !== newPropertyId) {
                // Delete from old property
                const oldExpenseRef = doc(db, 'properties', originalPropertyId, 'actualExpenses', editingExpense.id);
                batch.delete(oldExpenseRef);

                // Create in new property
                const newExpenseRef = doc(collection(db, 'properties', newPropertyId, 'actualExpenses'));
                batch.set(newExpenseRef, dataToSave);
            } else {
                // Update in same property
                const expenseRef = doc(db, 'properties', originalPropertyId, 'actualExpenses', editingExpense.id);
                batch.update(expenseRef, dataToSave);
            }

            // Apply new transaction to new wallet
            const newWalletRef = doc(db, 'wallets', data.walletId);
            // We need to re-fetch the wallet data in case old and new wallet are the same
            const newWalletSnap = await getDoc(newWalletRef);
            if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
            const newWalletData = newWalletSnap.data() as WalletType;
            
            // Recalculate balance before applying new amount
            let currentBalance = newWalletData.balance;
            if(editingExpense.walletId === data.walletId) {
                 currentBalance += editingExpense.amount;
            }

            if (currentBalance < data.amount && !newWalletData.allowNegativeBalance) {
                throw new Error(`Fondos insuficientes en la billetera ${newWalletData.name}.`);
            }
            batch.update(newWalletRef, { balance: currentBalance - data.amount });
            
            await batch.commit();

            toast({ title: "Gasto actualizado exitosamente" });
            setIsEditDialogOpen(false);
            setEditingExpense(null);
            fetchAllData();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el gasto.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deletingExpense) return;

        setIsSubmitting(true);
        const batch = writeBatch(db);
        const expenseRef = doc(db, 'properties', deletingExpense.propertyId, 'actualExpenses', deletingExpense.id);
        const walletRef = doc(db, 'wallets', deletingExpense.walletId);
            
        try {
            const walletSnap = await getDoc(walletRef);
            if (walletSnap.exists()) {
                const walletData = walletSnap.data() as WalletType;
                const newBalance = walletData.balance + deletingExpense.amount;
                batch.update(walletRef, { balance: newBalance });
            }
            
            if (deletingExpense.liabilityId) {
                const liabilityRef = doc(db, 'liabilities', deletingExpense.liabilityId);
                const liabilitySnap = await getDoc(liabilityRef);
                if (liabilitySnap.exists()) {
                    const liabilityData = liabilitySnap.data() as Liability;
                    batch.update(liabilityRef, { outstandingBalance: liabilityData.outstandingBalance + deletingExpense.amount });

                    const paymentsRef = collection(db, 'liabilities', deletingExpense.liabilityId, 'payments');
                    const q = query(paymentsRef, where('actualExpenseId', '==', deletingExpense.id));
                    const paymentsSnap = await getDocs(q);
                    paymentsSnap.forEach(paymentDoc => {
                        batch.delete(paymentDoc.ref);
                    });
                }
            }

            batch.delete(expenseRef);
            await batch.commit();

            toast({ title: "Gasto eliminado", variant: "destructive" });
            setDeletingExpense(null);
            fetchAllData();
        } catch(error) {
            console.error("Error deleting actual expense:", error);
            toast({ title: "Error", description: "No se pudo eliminar el gasto.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    }


    const handleClearFilters = () => {
        setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
        setSelectedCategory('all');
        setSelectedSubcategory('all');
        setSelectedCurrency('all');
        setSelectedWallet('all');
    };
    
    React.useEffect(() => {
        setSelectedSubcategory('all');
    }, [selectedCategory])
    
    const areFiltersActive = React.useMemo(() => {
        const isDefaultDate = date?.from?.getTime() === startOfMonth(new Date()).getTime() && date?.to?.getTime() === endOfMonth(new Date()).getTime();

        return (
            !isDefaultDate ||
            selectedCategory !== 'all' ||
            selectedSubcategory !== 'all' ||
            selectedCurrency !== 'all' ||
            selectedWallet !== 'all'
        );
    }, [date, selectedCategory, selectedSubcategory, selectedCurrency, selectedWallet]);

    const sortedAndFilteredExpenses = React.useMemo(() => {
        const selectedProperties = activeAccountId === 'all' ? properties.map(p => p.id) : [activeAccountId];
        
        let filtered = allExpenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            let match = true;
            
            if (!selectedProperties.includes(expense.propertyId)) match = false;
            if (date?.from && expenseDate < date.from) match = false;
            if (date?.to && expenseDate > date.to) match = false;

            if (selectedCurrency !== 'all' && expense.currency !== selectedCurrency) match = false;
            if (selectedWallet !== 'all' && expense.walletId !== selectedWallet) match = false;
            
            if (selectedCategory !== 'all') {
                const category = categories.find(c => c.id === selectedCategory);
                const subcategoryIds = category?.subcategories.map(s => s.id) || [];
                if (!subcategoryIds.includes(expense.subcategoryId)) {
                    match = false;
                }
            }
            if (selectedSubcategory !== 'all' && expense.subcategoryId !== selectedSubcategory) match = false;

            return match;
        });

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        
        return filtered;
    }, [allExpenses, date, selectedCurrency, selectedCategory, selectedSubcategory, selectedWallet, categories, sortConfig, activeAccountId, properties]);
    
    const expenseTotals = React.useMemo(() => {
        return sortedAndFilteredExpenses.reduce((acc, expense) => {
            acc[expense.currency] = (acc[expense.currency] || 0) + expense.amount;
            return acc;
        }, {} as Record<Currency, number>);
    }, [sortedAndFilteredExpenses]);

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
            <PageHeader title="Historial de Gastos">
                 <Button onClick={() => setIsAddDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Gasto
                </Button>
            </PageHeader>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Filter className="h-5 w-5"/> Filtros</div>
                        {areFiltersActive && <Button variant="ghost" size="sm" onClick={handleClearFilters}><X className="mr-2 h-4 w-4"/>Limpiar Filtros</Button>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-start gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-full grow sm:w-auto justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                            date.to ? (
                                <>
                                {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                {format(date.to, "LLL dd, y", { locale: es })}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y", { locale: es })
                            )
                            ) : (
                            <span>Elige una fecha</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            locale={es}
                        />
                        </PopoverContent>
                    </Popover>

                     <Select value={selectedWallet} onValueChange={setSelectedWallet}>
                        <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Billetera" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las billeteras</SelectItem>
                            {wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Categoría" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory} disabled={selectedCategory === 'all'}>
                        <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Subcategoría" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las subcategorías</SelectItem>
                            {categories.find(c => c.id === selectedCategory)?.subcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedCurrency} onValueChange={(v: any) => setSelectedCurrency(v)}>
                        <SelectTrigger className="w-full grow sm:grow-0 sm:w-auto"><SelectValue placeholder="Moneda" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las monedas</SelectItem>
                            <SelectItem value="ARS">ARS</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(Object.keys(expenseTotals) as Currency[]).map(currency => (
                    <Card key={currency}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Gastos ({currency})</CardTitle>
                             <TrendingDown className="h-5 w-5 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{formatCurrency(expenseTotals[currency], currency)}</div>
                            <p className="text-xs text-muted-foreground">{sortedAndFilteredExpenses.filter(e => e.currency === currency).length} transacciones</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {areFiltersActive && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Filtros Aplicados</AlertTitle>
                <AlertDescription>
                  Los resultados que se muestran a continuación están filtrados.{' '}
                  <Button variant="link" onClick={handleClearFilters} className="p-0 h-auto font-semibold">
                    Limpiar filtros
                  </Button>{' '}
                  para ver todos los gastos.
                </AlertDescription>
              </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Gastos</CardTitle>
                    <CardDescription>Se encontraron {sortedAndFilteredExpenses.length} gastos con los filtros aplicados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader
                                        label="Fecha"
                                        sortKey="date"
                                        sortConfig={sortConfig}
                                        onSort={setSortConfig}
                                    />
                                    <SortableHeader
                                        label="Cuenta"
                                        sortKey="propertyName"
                                        sortConfig={sortConfig}
                                        onSort={setSortConfig}
                                    />
                                    <SortableHeader
                                        label="Billetera"
                                        sortKey="walletName"
                                        sortConfig={sortConfig}
                                        onSort={setSortConfig}
                                    />
                                    <SortableHeader
                                        label="Categoría"
                                        sortKey="categoryName"
                                        sortConfig={sortConfig}
                                        onSort={setSortConfig}
                                    />
                                    <TableHead>Notas</TableHead>
                                    <SortableHeader
                                        label="Monto"
                                        sortKey="amount"
                                        sortConfig={sortConfig}
                                        onSort={setSortConfig}
                                        className="text-right"
                                    />
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedAndFilteredExpenses.length > 0 ? sortedAndFilteredExpenses.map(expense => {
                                    return (
                                    <TableRow key={expense.id}>
                                        <TableCell>{format(new Date(expense.date), 'PP', { locale: es })}</TableCell>
                                        <TableCell>{expense.propertyName}</TableCell>
                                        <TableCell>{expense.walletName}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{expense.subcategoryName}</div>
                                            <div className="text-xs text-muted-foreground">{expense.categoryName}</div>
                                        </TableCell>
                                        <TableCell>
                                            {expense.notes ? (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><FileText className="h-4 w-4" /></Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80"><p className="text-sm">{expense.notes}</p></PopoverContent>
                                            </Popover>
                                            ) : (
                                            <span className="text-muted-foreground text-xs italic">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-destructive">{formatCurrency(expense.amount, expense.currency)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(expense)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(expense)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24">No se encontraron gastos para los filtros seleccionados.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="md:hidden space-y-4">
                        <div className="flex items-center justify-end gap-2 mb-4">
                            <Label htmlFor="sort-select" className="text-sm font-medium">Ordenar por:</Label>
                            <Select
                                value={sortConfig?.key}
                                onValueChange={(value) => {
                                    setSortConfig({ key: value as keyof ExpenseWithDetails, direction: sortConfig?.direction || 'desc' });
                                }}
                            >
                                <SelectTrigger id="sort-select" className="w-auto h-9">
                                    <SelectValue placeholder="Ordenar por" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date">Fecha</SelectItem>
                                    <SelectItem value="amount">Monto</SelectItem>
                                    <SelectItem value="subcategoryName">Categoría</SelectItem>
                                    <SelectItem value="propertyName">Cuenta</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => {
                                    setSortConfig({ key: sortConfig?.key || 'date', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' });
                                }}
                            >
                                {sortConfig?.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            </Button>
                        </div>
                        {sortedAndFilteredExpenses.length > 0 ? sortedAndFilteredExpenses.map(expense => {
                             return (
                                <Card key={expense.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-1">
                                            <p className="font-semibold">{expense.subcategoryName}</p>
                                            <p className="text-sm text-muted-foreground">{expense.categoryName}</p>
                                            <p className="text-sm text-muted-foreground">{expense.propertyName} - {expense.walletName}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(expense.date), 'PP', { locale: es })}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="font-bold text-lg text-destructive">{formatCurrency(expense.amount, expense.currency)}</p>
                                            <div className='flex items-center'>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(expense)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(expense)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {expense.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{expense.notes}</p>}
                                </Card>
                             )
                        }) : (
                            <div className="text-center text-muted-foreground py-10">
                                No se encontraron gastos para los filtros seleccionados.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
        
        {isEditDialogOpen && (
             <AddExpenseDialog
                isOpen={isEditDialogOpen}
                onOpenChange={() => {setIsEditDialogOpen(false); setEditingExpense(null);}}
                onExpenseSubmit={handleUpdateExpenseSubmit}
                isSubmitting={isSubmitting}
                expenseToEdit={editingExpense}
                expenseCategories={categories}
                wallets={wallets}
                properties={properties}
                liabilities={liabilities}
                title="Editar Gasto"
            />
        )}
        {isAddDialogOpen && (
             <AddExpenseDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onExpenseSubmit={handleAddExpenseSubmit}
                isSubmitting={isSubmitting}
                expenseCategories={categories}
                wallets={wallets}
                properties={activeAccountId === 'all' ? properties : properties.filter(p => p.id === activeAccountId)}
                liabilities={liabilities}
                initialData={activeAccountId !== 'all' ? { propertyId: activeAccountId } : {}}
                title="Añadir Gasto"
            />
        )}
        <ConfirmDeleteDialog
            isOpen={!!deletingExpense}
            onOpenChange={() => setDeletingExpense(null)}
            onConfirm={confirmDelete}
            title="¿Eliminar Gasto?"
            description="Esta acción eliminará permanentemente el gasto y revertirá el saldo en la billetera asociada. ¿Estás seguro?"
        />
        </>
    );
}

