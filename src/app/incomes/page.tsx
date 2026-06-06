
'use client';

import * as React from 'react';
import { collection, getDocs, Timestamp, query, collectionGroup, doc, writeBatch, getDoc, where, orderBy } from 'firebase/firestore';
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
import { Loader, AlertTriangle, Filter, FileText, X, TrendingUp, Wallet, Pencil, Trash2, ArrowUp, ArrowDown, PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
import { type Income, type Property, type IncomeCategory, type Currency, type Wallet as WalletType, Asset, type IncomeSubcategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AddIncomeDialog, type IncomeFormValues } from '@/components/properties/AddIncomeDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SortableHeader, type SortConfig } from '@/components/shared/SortableHeader';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { useAccount } from '@/components/context/AccountProvider';


const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

// Extends Income to include propertyName and category details for easier display and sorting
type IncomeWithDetails = Income & { propertyName: string, categoryName: string, subcategoryName: string, walletName: string };

export default function IncomesPage() {
    const { toast } = useToast();
    const { activeAccountId } = useAccount();

    const [allIncomes, setAllIncomes] = React.useState<IncomeWithDetails[]>([]);
    const [properties, setProperties] = React.useState<Property[]>([]);
    const [categories, setCategories] = React.useState<IncomeCategory[]>([]);
    const [wallets, setWallets] = React.useState<WalletType[]>([]);
    
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
    const [sortConfig, setSortConfig] = React.useState<SortConfig<IncomeWithDetails>>({ key: 'date', direction: 'desc' });
    
    // Dialog State
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [editingIncome, setEditingIncome] = React.useState<IncomeWithDetails | null>(null);
    const [deletingIncome, setDeletingIncome] = React.useState<IncomeWithDetails | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const getCategoryInfo = React.useCallback((subcategoryId: string, cats: IncomeCategory[]) => {
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
            const [propsSnap, walletsSnap, incomesSnap, categoriesSnap] = await Promise.all([
                getDocs(query(collection(db, 'properties'))),
                getDocs(query(collection(db, 'wallets'))),
                getDocs(query(collectionGroup(db, 'incomes'))),
                getDocs(query(collection(db, 'incomeCategories'), orderBy('name'))),
            ]);

            const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
            const propsMap = new Map(propsList.map(p => [p.id, p.name]));
            setProperties(propsList);

            const walletsList = walletsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WalletType));
            const walletsMap = new Map(walletsList.map(w => [w.id, w.name]));
            setWallets(walletsList);

            const categoriesList = await Promise.all(categoriesSnap.docs.map(async (categoryDoc) => {
                const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
                const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
                const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as IncomeSubcategory));
                return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as IncomeCategory;
            }));
            setCategories(categoriesList);

            const incomesList = incomesSnap.docs.map(doc => {
                const data = doc.data() as Income;
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
                } as IncomeWithDetails;
            });
            setAllIncomes(incomesList);
            
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

    const handleEditClick = (income: IncomeWithDetails) => {
        setEditingIncome(income);
        setIsEditDialogOpen(true);
    };

    const handleDeleteClick = (income: IncomeWithDetails) => {
        setDeletingIncome(income);
    };

    const handleAddIncomeSubmit = async (data: IncomeFormValues) => {
        if (!data.propertyId) {
            toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el ingreso.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const batch = writeBatch(db);

        try {
            const incomeRef = doc(collection(db, 'properties', data.propertyId, 'incomes'));
            const walletRef = doc(db, 'wallets', data.walletId);
            
            const walletSnap = await getDoc(walletRef);
            if (!walletSnap.exists()) throw new Error("Billetera no encontrada.");
            
            const walletData = walletSnap.data() as WalletType;
            batch.update(walletRef, { balance: walletData.balance + data.amount });
            
            const incomeData: any = { ...data, date: Timestamp.fromDate(data.date) };
            if (incomeData.assetId === 'none' || !incomeData.assetId) {
                delete incomeData.assetId;
            }

            batch.set(incomeRef, incomeData);
            
            await batch.commit();
            toast({ title: "Ingreso añadido exitosamente" });
            setIsAddDialogOpen(false);
            fetchAllData();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "No se pudo registrar el ingreso.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleUpdateIncomeSubmit = async (data: IncomeFormValues) => {
        if (!editingIncome || !data.propertyId) return;
        setIsSubmitting(true);
    
        const batch = writeBatch(db);
        const originalPropertyId = editingIncome.propertyId;
        const newPropertyId = data.propertyId;

        const { propertyId, ...restOfData } = data;
        const dataToSave: any = { ...restOfData, date: Timestamp.fromDate(data.date) };
        if (dataToSave.assetId === 'none' || !dataToSave.assetId) {
            delete dataToSave.assetId;
        }
    
        try {
            // Revert original transaction from original wallet
            const oldWalletRef = doc(db, 'wallets', editingIncome.walletId);
            const oldWalletSnap = await getDoc(oldWalletRef);
            if (!oldWalletSnap.exists()) throw new Error("La billetera original no fue encontrada.");
            const oldWalletData = oldWalletSnap.data() as WalletType;
            batch.update(oldWalletRef, { balance: oldWalletData.balance - editingIncome.amount });
    
            // If property has changed, delete old and create new. Otherwise, update.
            if (originalPropertyId !== newPropertyId) {
                const oldIncomeRef = doc(db, 'properties', originalPropertyId, 'incomes', editingIncome.id);
                batch.delete(oldIncomeRef);
    
                const newIncomeRef = doc(collection(db, 'properties', newPropertyId, 'incomes'));
                batch.set(newIncomeRef, dataToSave);
            } else {
                const incomeRef = doc(db, 'properties', originalPropertyId, 'incomes', editingIncome.id);
                batch.update(incomeRef, dataToSave);
            }
    
            // Apply new transaction to new wallet
            const newWalletRef = doc(db, 'wallets', data.walletId);
            const newWalletSnap = await getDoc(newWalletRef);
            if (!newWalletSnap.exists()) throw new Error("La nueva billetera no fue encontrada.");
            const newWalletData = newWalletSnap.data() as WalletType;
    
            let currentBalance = newWalletData.balance;
            if (editingIncome.walletId === data.walletId) {
                currentBalance -= editingIncome.amount; // Re-add reverted amount if same wallet
            }
            batch.update(newWalletRef, { balance: currentBalance + data.amount });
    
            await batch.commit();
    
            toast({ title: "Ingreso actualizado exitosamente" });
            setIsEditDialogOpen(false);
            setEditingIncome(null);
            fetchAllData();
    
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "No se pudo guardar el ingreso.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const confirmDelete = async () => {
        if (!deletingIncome) return;

        setIsSubmitting(true);
        const batch = writeBatch(db);
        const incomeRef = doc(db, 'properties', deletingIncome.propertyId, 'incomes', deletingIncome.id);
        const walletRef = doc(db, 'wallets', deletingIncome.walletId);
        
        try {
            const walletSnap = await getDoc(walletRef);
            if (walletSnap.exists()) {
                const walletData = walletSnap.data() as WalletType;
                if (walletData.balance < deletingIncome.amount && !walletData.allowNegativeBalance) {
                     toast({ title: "Error", description: "Fondos insuficientes en la billetera para revertir el ingreso.", variant: "destructive" });
                     setIsSubmitting(false);
                     setDeletingIncome(null);
                     return;
                }
                const newBalance = walletData.balance - deletingIncome.amount;
                batch.update(walletRef, { balance: newBalance });
            }
            
            if (deletingIncome.assetId) {
                const assetRef = doc(db, 'assets', deletingIncome.assetId);
                const assetSnap = await getDoc(assetRef);
                if (assetSnap.exists()) {
                    const assetData = assetSnap.data() as Asset;
                    batch.update(assetRef, { outstandingBalance: assetData.outstandingBalance + deletingIncome.amount });

                    const collectionsRef = collection(db, 'assets', deletingIncome.assetId, 'collections');
                    const q = query(collectionsRef, where('incomeId', '==', deletingIncome.id));
                    const collectionsSnap = await getDocs(q);
                    collectionsSnap.forEach(collDoc => {
                        batch.delete(collDoc.ref);
                    });
                }
            }

            batch.delete(incomeRef);
            await batch.commit();

            toast({ title: "Ingreso eliminado", variant: "destructive" });
            setDeletingIncome(null);
            fetchAllData();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "No se pudo eliminar el ingreso.";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleClearFilters = () => {
        setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
        setSelectedCategory('all');
        setSelectedSubcategory('all');
        setSelectedCurrency('all');
        setSelectedWallet('all');
    };
    
    // Reset subcategory when category changes
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

    const sortedAndFilteredIncomes = React.useMemo(() => {
        const selectedProperties = activeAccountId === 'all' ? properties.map(p => p.id) : [activeAccountId];
        
        let filtered = allIncomes.filter(income => {
            const incomeDate = new Date(income.date);
            let match = true;

            if (!selectedProperties.includes(income.propertyId)) match = false;
            if (date?.from && incomeDate < date.from) match = false;
            if (date?.to && incomeDate > date.to) match = false;

            if (selectedCurrency !== 'all' && income.currency !== selectedCurrency) match = false;
            if (selectedWallet !== 'all' && income.walletId !== selectedWallet) match = false;
            
            if (selectedCategory !== 'all') {
                const category = categories.find(c => c.id === selectedCategory);
                const subcategoryIds = category?.subcategories.map(s => s.id) || [];
                if (!subcategoryIds.includes(income.subcategoryId)) {
                    match = false;
                }
            }
            if (selectedSubcategory !== 'all' && income.subcategoryId !== selectedSubcategory) match = false;

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
    }, [allIncomes, date, selectedCurrency, selectedCategory, selectedSubcategory, selectedWallet, categories, sortConfig, activeAccountId, properties]);
    
    const incomeTotals = React.useMemo(() => {
        return sortedAndFilteredIncomes.reduce((acc, income) => {
            acc[income.currency] = (acc[income.currency] || 0) + income.amount;
            return acc;
        }, {} as Record<Currency, number>);
    }, [sortedAndFilteredIncomes]);

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
            <PageHeader title="Historial de Ingresos">
                 <Button onClick={() => setIsAddDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Ingreso
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
                {(Object.keys(incomeTotals) as Currency[]).map(currency => (
                    <Card key={currency}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Ingresos ({currency})</CardTitle>
                             <TrendingUp className={cn(
                                'h-5 w-5',
                                currency === 'USD' ? 'text-green-500' : 'text-blue-500'
                            )} />
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-bold", {
                                'text-green-600 dark:text-green-400': currency === 'USD',
                                'text-blue-600 dark:text-blue-400': currency === 'ARS',
                            })}>
                                {formatCurrency(incomeTotals[currency], currency)}
                            </div>
                            <p className="text-xs text-muted-foreground">{sortedAndFilteredIncomes.filter(e => e.currency === currency).length} transacciones</p>
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
                  para ver todos los ingresos.
                </AlertDescription>
              </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Ingresos</CardTitle>
                    <CardDescription>Se encontraron {sortedAndFilteredIncomes.length} ingresos con los filtros aplicados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableHeader label="Fecha" sortKey="date" sortConfig={sortConfig} onSort={setSortConfig} />
                                    <SortableHeader label="Cuenta" sortKey="propertyName" sortConfig={sortConfig} onSort={setSortConfig} />
                                    <SortableHeader label="Billetera" sortKey="walletName" sortConfig={sortConfig} onSort={setSortConfig} />
                                    <SortableHeader label="Categoría" sortKey="categoryName" sortConfig={sortConfig} onSort={setSortConfig} />
                                    <TableHead>Notas</TableHead>
                                    <SortableHeader label="Monto" sortKey="amount" sortConfig={sortConfig} onSort={setSortConfig} className="text-right" />
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedAndFilteredIncomes.length > 0 ? sortedAndFilteredIncomes.map(income => {
                                    return (
                                    <TableRow key={income.id}>
                                        <TableCell>{format(new Date(income.date), 'PP', { locale: es })}</TableCell>
                                        <TableCell>{income.propertyName}</TableCell>
                                        <TableCell>{income.walletName}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{income.subcategoryName}</div>
                                            <div className="text-xs text-muted-foreground">{income.categoryName}</div>
                                        </TableCell>
                                        <TableCell>
                                            {income.notes ? (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><FileText className="h-4 w-4" /></Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80"><p className="text-sm">{income.notes}</p></PopoverContent>
                                            </Popover>
                                            ) : (
                                            <span className="text-muted-foreground text-xs italic">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className={cn("text-right font-semibold", {
                                            'text-green-600 dark:text-green-400': income.currency === 'USD',
                                            'text-blue-600 dark:text-blue-400': income.currency === 'ARS',
                                        })}>
                                            {formatCurrency(income.amount, income.currency)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(income)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(income)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24">No se encontraron ingresos para los filtros seleccionados.</TableCell>
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
                                    setSortConfig({ key: value as keyof IncomeWithDetails, direction: sortConfig?.direction || 'desc' });
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
                        {sortedAndFilteredIncomes.length > 0 ? sortedAndFilteredIncomes.map(income => {
                            const currencyClass = cn({
                                'text-green-600 dark:text-green-400': income.currency === 'USD',
                                'text-blue-600 dark:text-blue-400': income.currency === 'ARS',
                            });
                            return (
                                <Card key={income.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-1">
                                            <p className="font-semibold">{income.subcategoryName}</p>
                                            <p className="text-sm text-muted-foreground">{income.categoryName}</p>
                                            <p className="text-sm text-muted-foreground">{income.propertyName} - {income.walletName}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(income.date), 'PP', { locale: es })}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className={cn("font-bold text-lg", currencyClass)}>
                                                {formatCurrency(income.amount, income.currency)}
                                            </p>
                                            <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(income)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(income)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    {income.notes && <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{income.notes}</p>}
                                </Card>
                            )
                        }) : (
                            <div className="text-center text-muted-foreground py-10">
                                No se encontraron ingresos para los filtros seleccionados.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

        </div>

        {isEditDialogOpen && (
            <AddIncomeDialog
                isOpen={isEditDialogOpen}
                onOpenChange={() => { setIsEditDialogOpen(false); setEditingIncome(null);}}
                onIncomeSubmit={handleUpdateIncomeSubmit}
                isSubmitting={isSubmitting}
                incomeToEdit={editingIncome}
                incomeCategories={categories}
                wallets={wallets}
                properties={properties}
                title="Editar Ingreso"
            />
        )}
        {isAddDialogOpen && (
            <AddIncomeDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onIncomeSubmit={handleAddIncomeSubmit}
                isSubmitting={isSubmitting}
                incomeCategories={categories}
                wallets={wallets}
                properties={activeAccountId === 'all' ? properties : properties.filter(p => p.id === activeAccountId)}
                initialData={activeAccountId !== 'all' ? { propertyId: activeAccountId } : {}}
                title="Añadir Ingreso"
            />
        )}
        <ConfirmDeleteDialog
            isOpen={!!deletingIncome}
            onOpenChange={() => setDeletingIncome(null)}
            onConfirm={confirmDelete}
            title="¿Eliminar Ingreso?"
            description="Esta acción eliminará permanentemente el ingreso y revertirá el saldo en la billetera asociada. ¿Estás seguro?"
        />
        </>
    );
}

    

    

