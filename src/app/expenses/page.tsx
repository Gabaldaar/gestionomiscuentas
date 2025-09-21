
'use client';

import * as React from 'react';
import { collection, getDocs, Timestamp, query, collectionGroup } from 'firebase/firestore';
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
import { Loader, AlertTriangle, Filter, Calendar as CalendarIcon, FileText, X, TrendingDown } from 'lucide-react';
import { type ActualExpense, type Property, type ExpenseCategory, type Currency } from '@/lib/types';
import { cn } from '@/lib/utils';
import { type DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


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
    
    const fetchAllData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch properties
            const propsCol = collection(db, 'properties');
            const propsSnap = await getDocs(propsCol);
            const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
            const propsMap = new Map(propsList.map(p => [p.id, p.name]));
            setProperties(propsList);

            // Fetch expenses using a collection group query
            const expensesQuery = query(collectionGroup(db, 'actualExpenses'));
            const expensesSnap = await getDocs(expensesQuery);
            const expensesList = expensesSnap.docs.map(doc => {
                const data = doc.data();
                const propertyId = doc.ref.parent.parent!.id;
                return {
                    id: doc.id,
                    ...data,
                    date: (data.date as Timestamp).toDate().toISOString(),
                    propertyId: propertyId,
                    propertyName: propsMap.get(propertyId) || 'Cuenta Desconocida',
                } as ExpenseWithProperty;
            });
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

    const handleClearFilters = () => {
        setDateRange(undefined);
        setSelectedProperty('all');
        setSelectedCategory('all');
        setSelectedSubcategory('all');
        setSelectedCurrency('all');
    };
    
    // Reset subcategory when category changes
    React.useEffect(() => {
        setSelectedSubcategory('all');
    }, [selectedCategory])
    
    const areFiltersActive = React.useMemo(() => {
        return (
            !!dateRange?.from ||
            selectedProperty !== 'all' ||
            selectedCategory !== 'all' ||
            selectedSubcategory !== 'all' ||
            selectedCurrency !== 'all'
        );
    }, [dateRange, selectedProperty, selectedCategory, selectedSubcategory, selectedCurrency]);

    const filteredExpenses = React.useMemo(() => {
        return allExpenses.filter(expense => {
            let match = true;
            const expenseDate = new Date(expense.date);

            if (dateRange?.from && expenseDate < dateRange.from) match = false;
            if (dateRange?.to && expenseDate > dateRange.to) match = false;
            if (selectedProperty !== 'all' && expense.propertyId !== selectedProperty) match = false;
            if (selectedCurrency !== 'all' && expense.currency !== selectedCurrency) match = false;
            
            // Category filter needs to handle cases where subcategory might not be perfectly mapped.
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
    }, [allExpenses, dateRange, selectedProperty, selectedCurrency, selectedCategory, selectedSubcategory, categories]);
    
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
            <PageHeader title="Historial de Gastos" />
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Filter className="h-5 w-5"/> Filtros</div>
                        {areFiltersActive && <Button variant="ghost" size="sm" onClick={handleClearFilters}><X className="mr-2 h-4 w-4"/>Limpiar Filtros</Button>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                            <p className="text-xs text-muted-foreground">{filteredExpenses.filter(e => e.currency === currency).length} transacciones</p>
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
