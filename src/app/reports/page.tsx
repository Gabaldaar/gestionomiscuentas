
'use client';

import * as React from 'react';
import { collection, collectionGroup, getDocs, query, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader, AlertTriangle, Filter, Sparkles, Lightbulb, TrendingDown, Forward, LineChart as LineChartIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


import { type ActualExpense, type Income, type Property, type Currency, type ExpenseCategory, type ExpenseSubcategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { generateFinancialSummary, type FinancialSummaryOutput } from '@/ai/flows/generate-financial-summary';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAccount } from '@/components/context/AccountProvider';

type Transaction = Income | ActualExpense;

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#f59e0b", "#10b981", "#3b82f6"];

const monthsMap: {[key: string]: number} = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
};

const monthOptions = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
];

export default function ReportsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const { activeAccountId } = useAccount();
  const [allIncomes, setAllIncomes] = React.useState<Income[]>([]);
  const [allExpenses, setAllExpenses] = React.useState<ActualExpense[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [expenseCategories, setExpenseCategories] = React.useState<ExpenseCategory[]>([]);
  
  // AI Summary State
  const [aiSummary, setAiSummary] = React.useState<FinancialSummaryOutput | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);


  // Filters
  const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = React.useState<number[]>(monthOptions.map(m => m.value));
  const [groupBy, setGroupBy] = React.useState<'month' | 'year'>('month');
  const [currency, setCurrency] = React.useState<Currency>('ARS');
  
  const [availableYears, setAvailableYears] = React.useState<number[]>([]);


  const fetchAllData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [propsSnap, incomesSnap, expensesSnap, expenseCatSnap] = await Promise.all([
        getDocs(query(collection(db, 'properties'), orderBy('name'))),
        getDocs(query(collectionGroup(db, 'incomes'))),
        getDocs(query(collectionGroup(db, 'actualExpenses'))),
        getDocs(query(collection(db, 'expenseCategories'), orderBy('name')))
      ]);

      const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(propsList);

      const incomesList = incomesSnap.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, date: (data.date as Timestamp).toDate().toISOString(), propertyId: doc.ref.parent.parent?.id } as Income;
      });
      setAllIncomes(incomesList);

      const expensesList = expensesSnap.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, date: (data.date as Timestamp).toDate().toISOString(), propertyId: doc.ref.parent.parent?.id } as ActualExpense;
      });
      setAllExpenses(expensesList);

      const allTransactions = [...incomesList, ...expensesList];
      const years = new Set(allTransactions.map(t => new Date(t.date).getFullYear()));
      setAvailableYears(Array.from(years).sort((a,b) => b - a));
      
      const expenseCategoriesList = await Promise.all(expenseCatSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        const subcategoriesList = subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, ...subDoc.data() } as ExpenseSubcategory));
        return { id: categoryDoc.id, ...categoryDoc.data(), subcategories: subcategoriesList } as ExpenseCategory;
      }));
      setExpenseCategories(expenseCategoriesList);


    } catch (err) {
      console.error("Error fetching report data:", err);
      setError('No se pudo cargar la información. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleMonthSelection = (monthValue: number) => {
    setSelectedMonths(prev => 
      prev.includes(monthValue)
        ? prev.filter(m => m !== monthValue)
        : [...prev, monthValue]
    );
  }

  const handleSelectAllMonths = (checked: boolean) => {
    if (checked) {
        setSelectedMonths(monthOptions.map(m => m.value));
    } else {
        setSelectedMonths([]);
    }
  }

  const filteredTransactions = React.useMemo(() => {
    const propertiesToFilter = activeAccountId === 'all' ? properties.map(p => p.id) : [activeAccountId];

    const filter = (transactions: (Income[] | ActualExpense[])) => transactions.filter(t => {
        const transactionDate = new Date(t.date);
        const isSelectedProperty = t.propertyId && propertiesToFilter.includes(t.propertyId);
        
        const monthMatch = selectedMonths.includes(transactionDate.getMonth() + 1);
        const yearMatch = transactionDate.getFullYear() === selectedYear;

        const isCorrectCurrency = t.currency === currency;
        return isSelectedProperty && monthMatch && yearMatch && isCorrectCurrency;
    });
    
    const filterForCharts = (transactions: (Income[] | ActualExpense[])) => transactions.filter(t => {
        const isSelectedProperty = t.propertyId && propertiesToFilter.includes(t.propertyId);
        const isCorrectCurrency = t.currency === currency;
        return isSelectedProperty && isCorrectCurrency;
    });

    return {
        incomes: filter(allIncomes) as Income[],
        expenses: filter(allExpenses) as ActualExpense[],
        incomesForCharts: filterForCharts(allIncomes) as Income[],
        expensesForCharts: filterForCharts(allExpenses) as ActualExpense[],
    };
  }, [allIncomes, allExpenses, activeAccountId, properties, selectedMonths, selectedYear, currency]);


  const financialSummaryData = React.useMemo(() => {
    const data = new Map<string, { period: string, income: number, expense: number, net: number }>();
    
    const process = (transactions: Transaction[], type: 'income' | 'expense') => {
        transactions.forEach(t => {
            const key = groupBy === 'month' ? format(new Date(t.date), 'yyyy-MM') : format(new Date(t.date), 'yyyy');
            const periodLabel = groupBy === 'month' ? format(new Date(t.date), 'MMM yyyy', { locale: es }) : format(new Date(t.date), 'yyyy');

            if (!data.has(key)) {
                data.set(key, { period: periodLabel, income: 0, expense: 0, net: 0 });
            }

            const entry = data.get(key)!;
             if (type === 'income') {
                entry.income += t.amount;
            } else {
                entry.expense += t.amount;
            }
        });
    };

    process(filteredTransactions.incomesForCharts, 'income');
    process(filteredTransactions.expensesForCharts, 'expense');

    return Array.from(data.values())
        .map(d => ({ ...d, net: d.income - d.expense }))
        .sort((a, b) => {
            const dateA = groupBy === 'month' ? new Date(a.period.split(" ")[1], monthsMap[a.period.split(" ")[0].toLowerCase()]) : new Date(a.period);
            const dateB = groupBy === 'month' ? new Date(b.period.split(" ")[1], monthsMap[b.period.split(" ")[0].toLowerCase()]) : new Date(b.period);
            return dateA.getTime() - dateB.getTime();
        });

  }, [filteredTransactions, groupBy]);

  const byPropertyData = React.useMemo(() => {
    const data = new Map<string, { name: string, income: number, expense: number, net: number }>();

    const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || 'N/A';

    filteredTransactions.incomes.forEach(t => {
        if (!t.propertyId) return;
        if (!data.has(t.propertyId)) {
            data.set(t.propertyId, { name: getPropertyName(t.propertyId), income: 0, expense: 0, net: 0 });
        }
        data.get(t.propertyId)!.income += t.amount;
    });
    filteredTransactions.expenses.forEach(t => {
        if (!t.propertyId) return;
        if (!data.has(t.propertyId)) {
            data.set(t.propertyId, { name: getPropertyName(t.propertyId), income: 0, expense: 0, net: 0 });
        }
        data.get(t.propertyId)!.expense += t.amount;
    });

    return Array.from(data.values())
        .map(d => ({ ...d, net: d.income - d.expense }))
        .sort((a, b) => b.net - a.net);

  }, [filteredTransactions, properties]);
  
  const totalIncome = React.useMemo(() => byPropertyData.reduce((acc, r) => acc + r.income, 0), [byPropertyData]);
  const totalExpense = React.useMemo(() => byPropertyData.reduce((acc, r) => acc + r.expense, 0), [byPropertyData]);
  const netBalance = totalIncome - totalExpense;

  
  const expenseBreakdownData = React.useMemo(() => {
      const categoryMap = new Map<string, { name: string, value: number, subcategories: Map<string, {name: string, value: number}> }>();

      const subcategoryIdToInfo = new Map();
      expenseCategories.forEach(cat => {
          cat.subcategories.forEach(sub => {
              subcategoryIdToInfo.set(sub.id, { name: sub.name, parentId: cat.id, parentName: cat.name });
          });
      });

      filteredTransactions.expenses.forEach(exp => {
          const subcatInfo = subcategoryIdToInfo.get(exp.subcategoryId);
          if (!subcatInfo) return;

          // Main category aggregation
          if (!categoryMap.has(subcatInfo.parentId)) {
              categoryMap.set(subcatInfo.parentId, { name: subcatInfo.parentName, value: 0, subcategories: new Map() });
          }
          const categoryEntry = categoryMap.get(subcatInfo.parentId)!;
          categoryEntry.value += exp.amount;

          // Subcategory aggregation
          if (!categoryEntry.subcategories.has(exp.subcategoryId)) {
              categoryEntry.subcategories.set(exp.subcategoryId, { name: subcatInfo.name, value: 0 });
          }
          categoryEntry.subcategories.get(exp.subcategoryId)!.value += exp.amount;
      });
      
      const pieData = Array.from(categoryMap.values()).map(c => ({ name: c.name, value: c.value })).sort((a,b) => b.value - a.value);
      const tableData = Array.from(categoryMap.values()).map(c => ({
          ...c,
          subcategories: Array.from(c.subcategories.values()).sort((a,b) => b.value - a.value)
      })).sort((a,b) => b.value - a.value);
      
      return { pieData, tableData };

  }, [filteredTransactions.expenses, expenseCategories]);
  
  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    setAiSummary(null);
    setAiError(null);

    const currentPeriodData = financialSummaryData.find(d => {
        const periodDate = new Date(d.period.split(" ")[1], monthsMap[d.period.split(" ")[0].toLowerCase()]);
        return periodDate.getFullYear() === selectedYear && selectedMonths.includes(periodDate.getMonth() + 1);
    });

    if (!currentPeriodData) {
        setAiError("No hay datos en el período actual para analizar.");
        setIsGeneratingSummary(false);
        return;
    }

    try {
        const historicalDataForAI = financialSummaryData.map(d => ({
            period: d.period,
            income: d.income,
            expense: d.expense,
            net: d.net,
        }));

        const summary = await generateFinancialSummary({
            currency,
            currentPeriod: `${monthOptions.find(m => m.value === selectedMonths[0])?.label} ${selectedYear}`,
            historicalData: historicalDataForAI,
            expenseBreakdown: expenseBreakdownData.pieData,
        });
        setAiSummary(summary);
    } catch (e) {
        console.error("Error generating AI summary:", e);
        setAiError("No se pudo generar el resumen. Inténtalo de nuevo.");
    } finally {
        setIsGeneratingSummary(false);
    }
  }


  if (loading) return <div className="flex-1 p-8 flex justify-center items-center"><Loader className="h-8 w-8 animate-spin" /></div>;
  if (error) return <div className="flex-1 p-8 flex justify-center items-center"><Card><CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader><CardContent>{error}</CardContent></Card></div>;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Informes" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5"/> Filtros del Informe</CardTitle>
          <CardDescription>Selecciona los criterios para generar tu informe financiero.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-start gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>
              {availableYears.map(year => <SelectItem key={year} value={year.toString()}>{year}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start text-left font-normal">
                Meses ({selectedMonths.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <div className='flex items-center space-x-2 p-2'>
                    <Checkbox 
                        id="select-all-months" 
                        checked={selectedMonths.length === monthOptions.length} 
                        onCheckedChange={(checked) => handleSelectAllMonths(checked as boolean)}
                    />
                    <Label htmlFor='select-all-months' className='font-semibold'>Todos los meses</Label>
                </div>
                <hr className='my-1'/>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {monthOptions.map(month => (
                  <div key={month.value} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md">
                    <Checkbox 
                      id={`month-${month.value}`}
                      checked={selectedMonths.includes(month.value)} 
                      onCheckedChange={() => handleMonthSelection(month.value)}
                    />
                    <Label htmlFor={`month-${month.value}`} className="w-full cursor-pointer">{month.label}</Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Agrupar por..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Agrupar por Mes</SelectItem>
              <SelectItem value="year">Agrupar por Año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currency} onValueChange={(v: any) => setCurrency(v)}>
            <SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Moneda" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
        <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="summary">Resumen Financiero</TabsTrigger>
                <TabsTrigger value="expenses">Análisis de Gastos</TabsTrigger>
                <TabsTrigger value="ai">Resumen Inteligente</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
                {financialSummaryData.length > 0 ? (
                <div className="space-y-4">
                    <Card>
                    <CardHeader><CardTitle>Resumen Financiero ({currency}) - {selectedMonths.length === 1 ? monthOptions.find(m => m.value === selectedMonths[0])?.label : 'Período seleccionado'} {selectedYear}</CardTitle></CardHeader>
                    <CardContent>
                        {/* Desktop Table */}
                        <div className='hidden md:block'>
                          <Table>
                          <TableHeader>
                              <TableRow>
                              <TableHead>Cuenta</TableHead>
                              <TableHead className="text-right">Ingresos</TableHead>
                              <TableHead className="text-right">Gastos</TableHead>
                              <TableHead className="text-right">Saldo Neto</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {byPropertyData.map(row => (
                              <TableRow key={row.name}>
                                  <TableCell className="font-medium capitalize">{row.name}</TableCell>
                                  <TableCell className="text-right text-green-600">{formatCurrency(row.income, currency)}</TableCell>
                                  <TableCell className="text-right text-red-600">{formatCurrency(row.expense, currency)}</TableCell>
                                  <TableCell className={cn("text-right font-bold", row.net >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(row.net, currency)}</TableCell>
                              </TableRow>
                              ))}
                              <TableRow className="font-bold bg-muted/50">
                              <TableCell>Total</TableCell>
                              <TableCell className="text-right text-green-600">{formatCurrency(totalIncome, currency)}</TableCell>
                              <TableCell className="text-right text-red-600">{formatCurrency(totalExpense, currency)}</TableCell>
                              <TableCell className={cn("text-right font-bold", netBalance >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(netBalance, currency)}</TableCell>
                              </TableRow>
                          </TableBody>
                          </Table>
                        </div>
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {byPropertyData.map(row => (
                                <Card key={row.name} className="p-4">
                                    <p className="font-bold text-lg capitalize mb-2">{row.name}</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className='text-muted-foreground'>Ingresos:</span>
                                        <span className='font-medium text-green-600'>{formatCurrency(row.income, currency)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className='text-muted-foreground'>Gastos:</span>
                                        <span className='font-medium text-red-600'>{formatCurrency(row.expense, currency)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-base mt-2 pt-2 border-t">
                                        <span className='font-semibold'>Saldo Neto:</span>
                                        <span className={cn("font-bold", row.net >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(row.net, currency)}</span>
                                    </div>
                                </Card>
                            ))}
                             <Card className="p-4 bg-muted/50 font-bold">
                                    <p className="text-lg mb-2">Total General</p>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className='text-muted-foreground'>Ingresos:</span>
                                        <span className='font-medium text-green-600'>{formatCurrency(totalIncome, currency)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className='text-muted-foreground'>Gastos:</span>
                                        <span className='font-medium text-red-600'>{formatCurrency(totalExpense, currency)}</span>
                                    </div>
                                     <div className="flex justify-between items-center text-base mt-2 pt-2 border-t">
                                        <span className='font-semibold'>Saldo Neto:</span>
                                        <span className={cn("font-bold", netBalance >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(netBalance, currency)}</span>
                                    </div>
                                </Card>
                        </div>
                    </CardContent>
                    </Card>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader><CardTitle>Evolución del Saldo Neto ({currency})</CardTitle></CardHeader>
                            <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={financialSummaryData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value, currency).replace('$', '$ ')}`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                                <Legend />
                                <Line type="monotone" dataKey="net" name="Saldo Neto" stroke="hsl(var(--primary))" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Ingresos vs. Gastos ({currency})</CardTitle></CardHeader>
                            <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={financialSummaryData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value, currency).replace('$', '$ ')}`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                                <Legend />
                                <Bar dataKey="income" name="Ingresos" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" name="Gastos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                     <Card>
                        <CardHeader>
                            <CardTitle>Comparativa de Saldo Neto por Cuenta ({currency})</CardTitle>
                            <CardDescription>Compara el rendimiento neto (ingresos - gastos) de cada cuenta en el período seleccionado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={byPropertyData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value, currency).replace('$', '$ ')}`} />
                                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value, currency)} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="net" name="Saldo Neto">
                                        {byPropertyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.net >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                     </Card>
                </div>
                 ) : (
                <Card>
                    <CardContent className="p-10 text-center text-muted-foreground">
                        No hay datos para mostrar con los filtros seleccionados.
                    </CardContent>
                </Card>
                )}
            </TabsContent>
            <TabsContent value="expenses">
                {expenseBreakdownData.pieData.length > 0 ? (
                 <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Desglose de Gastos por Categoría ({currency})</CardTitle>
                            <CardDescription>Gasto Total del Período: <span className="font-bold">{formatCurrency(totalExpense, currency)}</span></CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <div>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie data={expenseBreakdownData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                            const RADIAN = Math.PI / 180;
                                            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                            const x  = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy  + radius * Math.sin(-midAngle * RADIAN);
                                            return (percent * 100) > 5 ? <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                                                {`${(percent * 100).toFixed(0)}%`}
                                            </text> : null;
                                        }}>
                                            {expenseBreakdownData.pieData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCurrency(value, currency)} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                             <div className="max-h-80 overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Categoría</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-right">% del Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {expenseBreakdownData.pieData.map((item, index) => (
                                            <TableRow key={item.name}>
                                                <TableCell className="font-medium flex items-center">
                                                    <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                                    {item.name}
                                                </TableCell>
                                                <TableCell className="text-right">{formatCurrency(item.value, currency)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                  {totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0.0'}%
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>Detalle por Subcategoría</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {/* Desktop Table */}
                          <div className="hidden md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Subcategoría</TableHead>
                                        <TableHead>Categoría Principal</TableHead>
                                        <TableHead className="text-right">Total Gastado</TableHead>
                                        <TableHead className="text-right">% de Categoría</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expenseBreakdownData.tableData.map((cat, catIndex) => (
                                        <React.Fragment key={cat.name}>
                                            <TableRow className="bg-muted/50">
                                                <TableCell colSpan={3} className="font-bold" style={{color: COLORS[catIndex % COLORS.length]}}>{cat.name}</TableCell>
                                                <TableCell className="text-right font-bold" style={{color: COLORS[catIndex % COLORS.length]}}>{formatCurrency(cat.value, currency)}</TableCell>
                                            </TableRow>
                                            {cat.subcategories.map(sub => (
                                                <TableRow key={sub.name}>
                                                    <TableCell className="pl-8">{sub.name}</TableCell>
                                                    <TableCell className="text-muted-foreground">{cat.name}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(sub.value, currency)}</TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                      {cat.value > 0 ? ((sub.value / cat.value) * 100).toFixed(1) : '0.0'}%
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                          </div>
                           {/* Mobile Cards */}
                          <div className="md:hidden space-y-4">
                             {expenseBreakdownData.tableData.map((cat, catIndex) => (
                                <Card key={cat.name} className="p-4">
                                  <div className="flex justify-between items-center mb-2" style={{color: COLORS[catIndex % COLORS.length]}}>
                                      <h4 className="font-bold text-lg">{cat.name}</h4>
                                      <p className="font-bold">{formatCurrency(cat.value, currency)}</p>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                      {cat.subcategories.map(sub => (
                                          <div key={sub.name} className="flex justify-between items-center border-t pt-1">
                                              <span className="text-muted-foreground">{sub.name}</span>
                                              <div className='text-right'>
                                                <span className="font-medium">{formatCurrency(sub.value, currency)}</span>
                                                <br/>
                                                <span className="text-xs text-muted-foreground">
                                                  ({cat.value > 0 ? ((sub.value / cat.value) * 100).toFixed(1) : '0.0'}%)
                                                </span>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                                </Card>
                              ))}
                          </div>
                        </CardContent>
                     </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Comparativa de Gastos por Cuenta ({currency})</CardTitle>
                            <CardDescription>Compara el gasto total de cada cuenta en el período seleccionado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={byPropertyData.map(d => ({name: d.name, expense: d.expense})).sort((a,b) => b.expense - a.expense)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${formatCurrency(value, currency).replace('$', '$ ')}`} />
                                    <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                    <Tooltip formatter={(value: number) => formatCurrency(value, currency)} cursor={{ fill: 'hsl(var(--muted))' }} />
                                    <Bar dataKey="expense" name="Gasto Total" fill="hsl(var(--chart-2))" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                 </div>
                ) : (
                <Card>
                    <CardContent className="p-10 text-center text-muted-foreground">
                        No hay gastos para mostrar con los filtros seleccionados.
                    </CardContent>
                </Card>
                )}
            </TabsContent>
            <TabsContent value="ai">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <Sparkles className="h-5 w-5 text-primary" />
                           Resumen Inteligente
                        </CardTitle>
                        <CardDescription>
                            Obtén un análisis automático de tus finanzas para el período y los filtros seleccionados.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary || financialSummaryData.length === 0}>
                            {isGeneratingSummary && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Generar Análisis
                        </Button>
                        
                        {isGeneratingSummary && (
                            <div className="space-y-4">
                                <Skeleton className="h-8 w-3/4" />
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-full" />
                                <Skeleton className="h-6 w-4/5" />
                            </div>
                        )}
                        
                        {aiError && (
                            <div className="text-destructive flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {aiError}
                            </div>
                        )}
                        
                        {aiSummary && (
                            <div className="space-y-6 text-sm">
                                <div className="flex items-start gap-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                                    <div className="bg-primary text-primary-foreground p-2 rounded-full">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Conclusión Principal</h4>
                                        <p>{aiSummary.highlight}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start gap-4">
                                    <div className="bg-blue-100 text-blue-700 p-2 rounded-full dark:bg-blue-900 dark:text-blue-300">
                                        <LineChartIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Análisis de Tendencias</h4>
                                        <p className="text-muted-foreground">{aiSummary.trendAnalysis}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                     <div className="bg-yellow-100 text-yellow-700 p-2 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
                                        <TrendingDown className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Análisis del Período Actual</h4>
                                        <p className="text-muted-foreground">{aiSummary.currentPeriodAnalysis}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-start gap-4">
                                    <div className="bg-green-100 text-green-700 p-2 rounded-full dark:bg-green-900 dark:text-green-300">
                                        <Lightbulb className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Sugerencia Futura</h4>
                                        <p className="text-muted-foreground">{aiSummary.futureSuggestion}</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 bg-purple-100/50 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-500/30 rounded-lg">
                                    <div className="bg-purple-500 text-white p-2 rounded-full">
                                        <Forward className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Mirando Hacia Adelante</h4>
                                        <p className="text-muted-foreground">{aiSummary.forwardLooking}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                    </CardContent>
                 </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
