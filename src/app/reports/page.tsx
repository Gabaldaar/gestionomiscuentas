
'use client';

import * as React from 'react';
import { collection, collectionGroup, getDocs, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader, AlertTriangle, Filter, Calendar as CalendarIcon, X } from 'lucide-react';

import { type ActualExpense, type Income, type Property, type Currency } from '@/lib/types';
import { cn } from '@/lib/utils';
import { type DateRange } from 'react-day-picker';

type Transaction = Income | ActualExpense;

const formatCurrency = (amount: number, currency: Currency) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export default function ReportsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [allIncomes, setAllIncomes] = React.useState<Income[]>([]);
  const [allExpenses, setAllExpenses] = React.useState<ActualExpense[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);

  // Filters
  const [selectedProperties, setSelectedProperties] = React.useState<string[]>([]);
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 1),
    to: new Date(),
  });
  const [groupBy, setGroupBy] = React.useState<'month' | 'year'>('month');
  const [currency, setCurrency] = React.useState<Currency>('ARS');

  const fetchAllData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [propsSnap, incomesSnap, expensesSnap] = await Promise.all([
        getDocs(collection(db, 'properties')),
        getDocs(query(collectionGroup(db, 'incomes'))),
        getDocs(query(collectionGroup(db, 'actualExpenses'))),
      ]);

      const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
      setProperties(propsList);
      setSelectedProperties(propsList.map(p => p.id));

      const incomesList = incomesSnap.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, date: (data.date as Timestamp).toDate().toISOString() } as Income;
      });
      setAllIncomes(incomesList);

      const expensesList = expensesSnap.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id, date: (data.date as Timestamp).toDate().toISOString() } as ActualExpense;
      });
      setAllExpenses(expensesList);

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

  const handlePropertySelection = (propertyId: string) => {
    setSelectedProperties(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };
  
  const handleSelectAllProperties = (checked: boolean) => {
    if (checked) {
        setSelectedProperties(properties.map(p => p.id));
    } else {
        setSelectedProperties([]);
    }
  }

  const reportData = React.useMemo(() => {
    const filteredTransactions = [...allIncomes, ...allExpenses].filter(t => {
      const transactionDate = new Date(t.date);
      const isSelectedProperty = selectedProperties.includes(t.propertyId);
      const isInDateRange = dateRange?.from && dateRange?.to 
        ? transactionDate >= dateRange.from && transactionDate <= dateRange.to
        : true;
      const isCorrectCurrency = t.currency === currency;
      return isSelectedProperty && isInDateRange && isCorrectCurrency;
    });

    const groupedData: Record<string, { period: string, income: number, expense: number, net: number }> = {};

    filteredTransactions.forEach(t => {
      const date = new Date(t.date);
      const key = groupBy === 'month' ? format(date, 'yyyy-MM') : format(date, 'yyyy');
      const periodLabel = groupBy === 'month' ? format(date, 'MMM yyyy', { locale: es }) : format(date, 'yyyy');

      if (!groupedData[key]) {
        groupedData[key] = { period: periodLabel, income: 0, expense: 0, net: 0 };
      }

      if ('notes' in t && t.propertyId) { // Heuristic check for Income/Expense
          if ((t as ActualExpense).amount > 0) { // All transactions here are either income or expense
            if ('walletId' in t) {
                // This is a rough check. 'walletId' exists on both. The proper way is to have a 'type' field.
                // For now, we assume if amount > 0 it is an income if it has walletId (which it will).
                // A better approach would be to check if it came from the incomes or expenses collection.
                // Let's check `subcategoryId` against income/expense categories if they were loaded.
                // Since they are not, we will assume positive is income, negative is expense for this context.
                // The provided data types have no 'type' field.
                const isExpense = allExpenses.some(e => e.id === t.id);
                if (isExpense) {
                    groupedData[key].expense += t.amount;
                } else {
                    groupedData[key].income += t.amount;
                }
            }
          }
      }
    });

    // We need to re-iterate because the above check is flawed.
    // Let's do it properly.
    Object.keys(groupedData).forEach(k => groupedData[k] = {period: groupedData[k].period, income: 0, expense: 0, net: 0});

    allIncomes
        .filter(t => selectedProperties.includes(t.propertyId) && t.currency === currency && dateRange?.from && dateRange.to && new Date(t.date) >= dateRange.from && new Date(t.date) <= dateRange.to)
        .forEach(t => {
            const date = new Date(t.date);
            const key = groupBy === 'month' ? format(date, 'yyyy-MM') : format(date, 'yyyy');
            if(groupedData[key]) groupedData[key].income += t.amount;
        });

     allExpenses
        .filter(t => selectedProperties.includes(t.propertyId) && t.currency === currency && dateRange?.from && dateRange.to && new Date(t.date) >= dateRange.from && new Date(t.date) <= dateRange.to)
        .forEach(t => {
            const date = new Date(t.date);
            const key = groupBy === 'month' ? format(date, 'yyyy-MM') : format(date, 'yyyy');
            if(groupedData[key]) groupedData[key].expense += t.amount;
        });


    return Object.values(groupedData).map(d => ({
      ...d,
      net: d.income - d.expense,
    })).sort((a,b) => a.period.localeCompare(b.period));

  }, [allIncomes, allExpenses, selectedProperties, dateRange, groupBy, currency]);

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
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                  ) : format(dateRange.from, "LLL dd, y")
                ) : <span>Elige un rango</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es}/>
            </PopoverContent>
          </Popover>

          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger><SelectValue placeholder="Agrupar por..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Agrupar por Mes</SelectItem>
              <SelectItem value="year">Agrupar por Año</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currency} onValueChange={(v: any) => setCurrency(v)}>
            <SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
          
           <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                Cuentas ({selectedProperties.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
                <div className='flex items-center space-x-2 p-2'>
                    <Checkbox 
                        id="select-all-props" 
                        checked={selectedProperties.length === properties.length} 
                        onCheckedChange={handleSelectAllProperties}
                    />
                    <Label htmlFor='select-all-props' className='font-semibold'>Todas las cuentas</Label>
                </div>
                <hr className='my-1'/>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {properties.map(prop => (
                  <div key={prop.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md">
                    <Checkbox 
                      id={prop.id} 
                      checked={selectedProperties.includes(prop.id)} 
                      onCheckedChange={() => handlePropertySelection(prop.id)}
                    />
                    <Label htmlFor={prop.id} className="w-full cursor-pointer">{prop.name}</Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

        </CardContent>
      </Card>
      
      {reportData.length > 0 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Resumen Financiero ({currency})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Gastos</TableHead>
                    <TableHead className="text-right">Saldo Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map(row => (
                    <TableRow key={row.period}>
                      <TableCell className="font-medium capitalize">{row.period}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(row.income, currency)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(row.expense, currency)}</TableCell>
                      <TableCell className={cn("text-right font-bold", row.net >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(row.net, currency)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold bg-muted/50">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(reportData.reduce((acc, r) => acc + r.income, 0), currency)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(reportData.reduce((acc, r) => acc + r.expense, 0), currency)}</TableCell>
                    <TableCell className={cn("text-right font-bold", reportData.reduce((acc, r) => acc + r.net, 0) >= 0 ? "text-primary" : "text-destructive")}>{formatCurrency(reportData.reduce((acc, r) => acc + r.net, 0), currency)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>Evolución del Saldo Neto ({currency})</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reportData}>
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
                  <BarChart data={reportData}>
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

        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No hay datos para mostrar con los filtros seleccionados.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

    