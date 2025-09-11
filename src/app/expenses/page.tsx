
'use client';

import * as React from 'react';
import { collection, getDocs, Timestamp, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader, AlertTriangle, Filter, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { type ActualExpense, type Property, type ExpenseCategory, type Currency } from '@/lib/types';
import { cn } from '@/lib/utils';
import { type DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';


const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

// Extends ActualExpense to include propertyName for easier display
type ExpenseWithProperty = ActualExpense & { propertyName: string };

export default function ExpensesPage() {
    const { toast } = useToast();

    const [allExpenses, setAllExpenses] = React.useState<ExpenseWithProperty[]>([]);
    const [properties, setProperties] = React.useState<Property[]>([]);
    const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
    
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filter states
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [selectedProperty, setSelectedProperty] = React.useState('all');
    const [selectedCategory, setSelectedCategory] = React.useState('all');
    const [selectedSubcategory, setSelectedSubcategory] = React.useState('all');
    const [selectedCurrency, setSelectedCurrency] = React.useState<Currency | 'all'>('all');
    
    // Active filters
    const [activeFilters, setActiveFilters] = React.useState({
        dateRange,
        property: selectedProperty,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        currency: selectedCurrency,
    });
    
    const fetchAllData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch properties
            const propsCol = collection(db, 'properties');
            const propsSnap = await getDocs(propsCol);
            const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
            setProperties(propsList);

            // Fetch expenses for all properties
            let expensesList: ExpenseWithProperty[] = [];
            for (const prop of propsList) {
                const expensesCol = collection(db, 'properties', prop.id, 'actualExpenses');
                const expensesSnap = await getDocs(query(expensesCol));
                const propExpenses = expensesSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        date: (data.date as Timestamp).toDate().toISOString(),
                        propertyId: prop.id,
                        propertyName: prop.name,
                    } as ExpenseWithProperty;
                });
                expensesList = [...expensesList, ...propExpenses];
            }
            setAllExpenses(expensesList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            // Fetch categories
            const categoriesQuery = query(collection(db, 'expenseCategories'));
            const categoriesSnapshot = await getDocs(categoriesQuery);
            const categoriesList = await Promise.all(categoriesSnapshot.docs.map(async (categoryDoc) => {
                const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'));
                const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
                const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name }));
                return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesList } as ExpenseCategory;
            }));
            setCategories(categoriesList);

        } catch (err) {
            console.error("Error fetching data:", err);
            setError('No se pudo cargar la información. Por favor, inténtalo de nuevo.');
            toast({ title: 'Error', description: 'No se pudo cargar la información.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleApplyFilters = () => {
        setActiveFilters({
            dateRange,
            property: selectedProperty,
            category: selectedCategory,
            subcategory: selectedSubcategory,
            currency: selectedCurrency,
        });
    };

    const handleClearFilters = () => {
        setDateRange(undefined);
        setSelectedProperty('all');
        setSelectedCategory('all');
        setSelectedSubcategory('all');
        setSelectedCurrency('all');
        setActiveFilters({
            dateRange: undefined,
            property: 'all',
            category: 'all',
            subcategory: 'all',
            currency: 'all',
        });
    };
    
    // Reset subcategory when category changes
    React.useEffect(() => {
        setSelectedSubcategory('all');
    }, [selectedCategory])

    const filteredExpenses = React.useMemo(() => {
        return allExpenses.filter(expense => {
            let match = true;
            const expenseDate = new Date(expense.date);

            if (activeFilters.dateRange?.from && expenseDate < activeFilters.dateRange.from) match = false;
            if (activeFilters.dateRange?.to && expenseDate > activeFilters.dateRange.to) match = false;
            if (activeFilters.property !== 'all' && expense.propertyId !== activeFilters.property) match = false;
            if (activeFilters.currency !== 'all' && expense.currency !== activeFilters.currency) match = false;
            if (activeFilters.category !== 'all') {
                const category = categories.find(c => c.id === activeFilters.category);
                const subcategoryIds = category?.subcategories.map(s => s.id) || [];
                if (!subcategoryIds.includes(expense.subcategoryId)) {
                    match = false;
                }
            }
            if (activeFilters.subcategory !== 'all' && expense.subcategoryId !== activeFilters.subcategory) match = false;

            return match;
        });
    }, [allExpenses, activeFilters, categories]);
    
    const expenseTotals = React.useMemo(() => {
        return filteredExpenses.reduce((acc, expense) => {
            acc[expense.currency] = (acc[expense.currency] || 0) + expense.amount;
            return acc;
        }, {} as Record<Currency, number>);
    }, [filteredExpenses]);


    const getCategoryInfo = (subcategoryId: string) => {
        for (const cat of categories) {
            const subcat = cat.subcategories.find(s => s.id === subcategoryId);
            if (subcat) return { categoryName: cat.name, subcategoryName: subcat.name };
        }
        return { categoryName: 'N/A', subcategoryName: 'N/A' };
    };

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
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader title="Panel de Gastos" />
            
            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>{format(dateRange.from, "LLL dd, y", { locale: es })} - {format(dateRange.to, "LLL dd, y", { locale: es })}</>
                                ) : (
                                    format(dateRange.from, "LLL dd, y", { locale: es })
                                )
                            ) : (
                                <span>Elige un rango de fechas</span>
                            )}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es} />
                        </PopoverContent>
                    </Popover>
                    
                    <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                        <SelectTrigger><SelectValue placeholder="Cuenta" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las cuentas</SelectItem>
                            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory} disabled={selectedCategory === 'all'}>
                        <SelectTrigger><SelectValue placeholder="Subcategoría" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las subcategorías</SelectItem>
                            {categories.find(c => c.id === selectedCategory)?.subcategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={selectedCurrency} onValueChange={(v: any) => setSelectedCurrency(v)}>
                        <SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las monedas</SelectItem>
                            <SelectItem value="ARS">ARS</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2 col-span-full md:col-span-1 md:col-start-3 lg:col-start-5">
                       <Button onClick={handleApplyFilters} className="flex-1"><Filter className="mr-2 h-4 w-4" />Aplicar</Button>
                       <Button variant="ghost" onClick={handleClearFilters} className="flex-1">Limpiar</Button>
                    </div>
                </CardContent>
            </Card>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(Object.keys(expenseTotals) as Currency[]).map(currency => (
                    <Card key={currency}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total de Gastos ({currency})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(expenseTotals[currency], currency)}</div>
                            <p className="text-xs text-muted-foreground">{filteredExpenses.filter(e => e.currency === currency).length} transacciones</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Gastos</CardTitle>
                    <CardDescription>Se encontraron {filteredExpenses.length} gastos con los filtros aplicados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Cuenta</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Notas</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredExpenses.length > 0 ? filteredExpenses.map(expense => {
                                const { categoryName, subcategoryName } = getCategoryInfo(expense.subcategoryId);
                                return (
                                <TableRow key={expense.id}>
                                    <TableCell>{format(new Date(expense.date), 'PP', { locale: es })}</TableCell>
                                    <TableCell>{expense.propertyName}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{subcategoryName}</div>
                                        <div className="text-xs text-muted-foreground">{categoryName}</div>
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
                                </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No se encontraron gastos para los filtros seleccionados.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}

