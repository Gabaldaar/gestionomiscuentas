
'use client';

import * as React from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { collection, getDocs, doc, getDoc, updateDoc, query, Timestamp, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader, AlertTriangle, ArrowDown, ArrowUp, ArrowRightLeft, Pencil, Filter, Calendar as CalendarIcon, DollarSign, CircleDollarSign, FileText, RefreshCw } from 'lucide-react';
import { type Wallet, type Transaction, type ActualExpense, type Income, type Transfer, type Property, type ExpenseCategory, type IncomeCategory } from '@/lib/types';
import { cn } from '@/lib/utils';
import { WalletIcon, type WalletIconName } from '@/lib/wallet-icons';
import { type DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatCurrency = (amount: number | null | undefined, currency?: string | null) => {
  const safeCurrency = (currency === 'USD' || currency === 'ARS') ? currency : 'ARS';
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency }).format(safeAmount);
  } catch {
    return `${safeCurrency === 'USD' ? 'US$' : '$'} ${safeAmount.toFixed(2)}`;
  }
};

type TransactionWithBalance = Transaction & { runningBalance: number };

async function getAllTransactionsForWallet(walletId: string): Promise<{transactions: Transaction[], properties: Map<string, string>}> {
    const transactions: Transaction[] = [];
    const propertiesMap = new Map<string, string>();

    const [propsSnap, incomesCatSnap, expensesCatSnap, incomesSnap, expensesSnap, transfersSnap, walletsSnap] = await Promise.all([
      getDocs(query(collection(db, 'properties'))),
      getDocs(query(collection(db, 'incomeCategories'))),
      getDocs(query(collection(db, 'expenseCategories'))),
      getDocs(query(collectionGroup(db, 'incomes'))),
      getDocs(query(collectionGroup(db, 'actualExpenses'))),
      getDocs(query(collection(db, 'transfers'))),
      getDocs(query(collection(db, 'wallets')))
    ]);
    
    propsSnap.docs.forEach(doc => {
      propertiesMap.set(doc.id, (doc.data() as Property).name);
    });

    const walletsMap = new Map(walletsSnap.docs.map(d => [d.id, d.data().name]));

    const incomeCategories: IncomeCategory[] = await Promise.all(incomesCatSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
    }));

    const expenseCategories: ExpenseCategory[] = await Promise.all(expensesCatSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
    }));

    const getCategoryInfo = (subcategoryId: string, type: 'income' | 'expense') => {
        const categories = type === 'income' ? incomeCategories : expenseCategories;
        for (const cat of categories) {
            const subcat = cat.subcategories.find(s => s.id === subcategoryId);
            if (subcat) return { categoryName: cat.name, subcategoryName: subcat.name };
        }
        return { categoryName: 'N/A', subcategoryName: 'N/A' };
    };

    incomesSnap.docs
      .filter(doc => doc.ref.parent.parent && !doc.ref.parent.parent.parent)
      .forEach(doc => {
        const data = doc.data() as Income;
        if (data.walletId === walletId) {
            const propId = doc.ref.parent.parent ? doc.ref.parent.parent.id : (data.propertyId || '');
            const propName = propertiesMap.get(propId) || 'Cuenta Desconocida';
            const { categoryName, subcategoryName } = getCategoryInfo(data.subcategoryId, 'income');
            let dateObj = new Date();
            try {
                if ((data.date as any)?.toDate) dateObj = (data.date as any).toDate();
                else if (data.date) dateObj = new Date(data.date);
            } catch {}

            transactions.push({
                id: `income-${doc.id}`,
                date: dateObj,
                type: 'income',
                amount: data.amount,
                currency: data.currency,
                description: subcategoryName,
                relatedEntity: propName,
                notes: data.notes,
                category: categoryName
            });
        }
    });

    expensesSnap.docs
      .filter(doc => doc.ref.parent.parent && !doc.ref.parent.parent.parent)
      .forEach(doc => {
        const data = doc.data() as ActualExpense;
        if (data.walletId === walletId) {
            const propId = doc.ref.parent.parent ? doc.ref.parent.parent.id : (data.propertyId || '');
            const propName = propertiesMap.get(propId) || 'Cuenta Desconocida';
            const { categoryName, subcategoryName } = getCategoryInfo(data.subcategoryId, 'expense');
            let dateObj = new Date();
            try {
                if ((data.date as any)?.toDate) dateObj = (data.date as any).toDate();
                else if (data.date) dateObj = new Date(data.date);
            } catch {}

            transactions.push({
                id: `expense-${doc.id}`,
                date: dateObj,
                type: 'expense',
                amount: -data.amount,
                currency: data.currency,
                description: subcategoryName,
                relatedEntity: propName,
                notes: data.notes,
                category: categoryName
            });
        }
    });

    transfersSnap.docs.forEach(doc => {
        const transfer = { id: doc.id, ...doc.data() } as Transfer;
        let dateObj = new Date();
        try {
            if ((transfer.date as any)?.toDate) dateObj = (transfer.date as any).toDate();
            else if (transfer.date) dateObj = new Date(transfer.date);
        } catch {}

        if (transfer.fromWalletId === walletId) {
            transactions.push({
                id: `transfer-out-${doc.id}`,
                date: dateObj,
                type: 'transfer_out',
                amount: -transfer.amountSent,
                currency: transfer.fromCurrency,
                description: 'Transferencia Enviada',
                relatedEntity: `a ${walletsMap.get(transfer.toWalletId) ?? 'otra billetera'}`,
                notes: transfer.notes,
                category: 'Transferencias'
            });
        }
        if (transfer.toWalletId === walletId) {
             transactions.push({
                id: `transfer-in-${doc.id}`,
                date: dateObj,
                type: 'transfer_in',
                amount: transfer.amountReceived,
                currency: transfer.toCurrency,
                description: 'Transferencia Recibida',
                relatedEntity: `de ${walletsMap.get(transfer.fromWalletId) ?? 'otra billetera'}`,
                notes: transfer.notes,
                category: 'Transferencias'
            });
        }
    });

    return { transactions: transactions.sort((a, b) => a.date.getTime() - b.date.getTime()), properties: propertiesMap };
}


export default function WalletDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    
    const { toast } = useToast();
    const [wallet, setWallet] = React.useState<Wallet | null>(null);
    const [transactions, setTransactions] = React.useState<TransactionWithBalance[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isSyncing, setIsSyncing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Filters
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [descriptionFilter, setDescriptionFilter] = React.useState('');
    const [typeFilter, setTypeFilter] = React.useState<'all' | 'income' | 'expense' | 'transfer'>('all');

    const fetchWalletData = React.useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const walletRef = doc(db, 'wallets', id);
            const walletSnap = await getDoc(walletRef);

            if (walletSnap.exists()) {
                const walletData = { id: walletSnap.id, ...walletSnap.data() } as Wallet;
                setWallet(walletData);
                const { transactions: rawTransactions } = await getAllTransactionsForWallet(id);
                
                // Calculate historical balances
                const totalTransactionEffect = rawTransactions.reduce((sum, t) => sum + t.amount, 0);
                let runningBalance = walletData.balance - totalTransactionEffect;

                const transactionsWithBalance = rawTransactions.map(t => {
                    runningBalance += t.amount;
                    return { ...t, runningBalance };
                });

                setTransactions(transactionsWithBalance.reverse()); // Reverse to show newest first
            } else {
                setError('Billetera no encontrada.');
            }
        } catch (err) {
            console.error("Error fetching wallet data:", err);
            setError('No se pudo cargar la información de la billetera.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    React.useEffect(() => {
        fetchWalletData();
    }, [fetchWalletData]);

    const stats = React.useMemo(() => {
        let totalIncomes = 0;
        let totalExpenses = 0;
        let totalTransfersIn = 0;
        let totalTransfersOut = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncomes += t.amount;
            else if (t.type === 'expense') totalExpenses += Math.abs(t.amount);
            else if (t.type === 'transfer_in') totalTransfersIn += t.amount;
            else if (t.type === 'transfer_out') totalTransfersOut += Math.abs(t.amount);
        });

        const netSum = totalIncomes - totalExpenses + totalTransfersIn - totalTransfersOut;
        return { totalIncomes, totalExpenses, totalTransfersIn, totalTransfersOut, netSum };
    }, [transactions]);

    const handleSyncBalance = async () => {
        if (!wallet) return;
        const confirmed = window.confirm(
            `¿Deseas sincronizar el saldo de "${wallet.name}" con la suma de los movimientos registrados?\n\nSaldo actual guardado: ${formatCurrency(wallet.balance, wallet.currency)}\nSaldo según movimientos: ${formatCurrency(stats.netSum, wallet.currency)}\n\nEsta acción reemplazará el saldo guardado.`
        );
        if (!confirmed) return;

        setIsSyncing(true);
        try {
            const walletRef = doc(db, 'wallets', wallet.id);
            await updateDoc(walletRef, { balance: stats.netSum });
            setWallet(prev => prev ? { ...prev, balance: stats.netSum } : null);
            toast({
                title: "Saldo sincronizado",
                description: `El saldo de la billetera se actualizó a ${formatCurrency(stats.netSum, wallet.currency)}.`,
            });
            fetchWalletData();
        } catch (e) {
            toast({
                title: "Error",
                description: "No se pudo actualizar el saldo.",
                variant: "destructive"
            });
        } finally {
            setIsSyncing(false);
        }
    };
    
    const filteredTransactions = React.useMemo(() => {
        return transactions.filter(t => {
            let match = true;
            if (dateRange?.from && t.date < dateRange.from) {
                match = false;
            }
            if (dateRange?.to && t.date > dateRange.to) {
                match = false;
            }
            if (descriptionFilter && !t.description.toLowerCase().includes(descriptionFilter.toLowerCase()) && !t.relatedEntity.toLowerCase().includes(descriptionFilter.toLowerCase())) {
                match = false;
            }
            if (typeFilter !== 'all') {
                if (typeFilter === 'income' && t.type !== 'income') match = false;
                if (typeFilter === 'expense' && t.type !== 'expense') match = false;
                if (typeFilter === 'transfer' && !t.type.startsWith('transfer')) match = false;
            }
            return match;
        });
    }, [transactions, dateRange, descriptionFilter, typeFilter]);

    const renderIcon = (wallet: Wallet) => {
        const iconClass = cn('h-8 w-8', {
            'text-green-700 dark:text-green-300': wallet.currency === 'USD',
            'text-blue-700 dark:text-blue-300': wallet.currency === 'ARS',
        });

        if (wallet.icon) {
            return <WalletIcon name={wallet.icon as WalletIconName} className={iconClass} />;
        }
        return wallet.currency === 'USD' ? <DollarSign className={iconClass} /> : <CircleDollarSign className={iconClass} />;
    };
    
    const transactionIcon = (type: Transaction['type']) => {
        switch (type) {
            case 'income': return <ArrowUp className="h-5 w-5 text-green-500" />;
            case 'expense': return <ArrowDown className="h-5 w-5 text-red-500" />;
            case 'transfer_in':
            case 'transfer_out': return <ArrowRightLeft className="h-5 w-5 text-blue-500" />;
            default: return null;
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
                    <CardHeader>
                        <CardTitle className='text-destructive flex items-center gap-2'>
                            <AlertTriangle/> Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                        <Button onClick={() => router.push('/wallets')} className="mt-4">Volver a Billeteras</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!wallet) {
        notFound();
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader title={wallet.name}>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleSyncBalance} 
                        disabled={isSyncing}
                        className="text-xs"
                    >
                        {isSyncing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Alinear saldo con movimientos
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/wallets/${wallet.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar Billetera
                        </Link>
                    </Button>
                </div>
            </PageHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4 py-4">
                        <div className={cn("p-3 rounded-lg", {
                            'bg-green-100 dark:bg-green-900': wallet.currency === 'USD',
                            'bg-blue-100 dark:bg-blue-900': wallet.currency === 'ARS',
                        })}>
                           {renderIcon(wallet)}
                        </div>
                        <div className="flex-1">
                            <CardDescription>Saldo Actual en Billetera</CardDescription>
                            <CardTitle className={cn("text-2xl font-bold", {
                                'text-green-600 dark:text-green-400': wallet.currency === 'USD',
                                'text-blue-600 dark:text-blue-400': wallet.currency === 'ARS',
                                'text-destructive': wallet.balance < 0,
                            })}>
                                {formatCurrency(wallet.balance, wallet.currency)}
                            </CardTitle>
                            {Math.abs(wallet.balance - stats.netSum) > 0.01 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                    Suma de movimientos: {formatCurrency(stats.netSum, wallet.currency)}
                                </p>
                            )}
                        </div>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="py-4">
                        <CardDescription>Ingresos vs Gastos</CardDescription>
                        <div className="flex justify-between items-center mt-2">
                            <div>
                                <span className="text-xs text-muted-foreground">Ingresos</span>
                                <p className="text-sm font-semibold text-green-600 dark:text-green-400">+{formatCurrency(stats.totalIncomes, wallet.currency)}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-muted-foreground">Gastos</span>
                                <p className="text-sm font-semibold text-destructive">-{formatCurrency(stats.totalExpenses, wallet.currency)}</p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="py-4">
                        <CardDescription>Transferencias Registradas</CardDescription>
                        <div className="flex justify-between items-center mt-2">
                            <div>
                                <span className="text-xs text-muted-foreground">Recibidas</span>
                                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">+{formatCurrency(stats.totalTransfersIn, wallet.currency)}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-muted-foreground">Enviadas</span>
                                <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">-{formatCurrency(stats.totalTransfersOut, wallet.currency)}</p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Movimientos</CardTitle>
                    <CardDescription>Todos los movimientos asociados a esta billetera.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full sm:w-[260px] justify-start text-left font-normal",
                                !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                    {format(dateRange.from, "LLL dd, y", { locale: es })} -{" "}
                                    {format(dateRange.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(dateRange.from, "LLL dd, y", { locale: es })
                                )
                                ) : (
                                <span>Elige un rango de fechas</span>
                                )}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                locale={es}
                            />
                            </PopoverContent>
                        </Popover>
                         <Input
                            placeholder="Filtrar por descripción..."
                            value={descriptionFilter}
                            onChange={(e) => setDescriptionFilter(e.target.value)}
                            className="w-full sm:w-[240px]"
                         />
                         <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                            <SelectTrigger className="w-full sm:w-auto">
                                <SelectValue placeholder="Tipo de movimiento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los movimientos</SelectItem>
                                <SelectItem value="income">Ingresos</SelectItem>
                                <SelectItem value="expense">Gastos</SelectItem>
                                <SelectItem value="transfer">Transferencias</SelectItem>
                            </SelectContent>
                        </Select>
                         <Button onClick={() => { setDateRange(undefined); setDescriptionFilter(''); setTypeFilter('all'); }}>
                            <Filter className="mr-2 h-4 w-4" /> Limpiar
                         </Button>
                    </div>

                    <div className="space-y-4">
                        {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                            <Card key={t.id} className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        {transactionIcon(t.type)}
                                        <div>
                                            <p className="font-semibold">{t.description}</p>
                                            <p className="text-sm text-muted-foreground">{t.category} | {t.relatedEntity}</p>
                                            <p className="text-xs text-muted-foreground">{format(t.date, 'PP', { locale: es })}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn("font-bold text-lg", t.amount > 0 ? "text-green-500" : "text-red-500")}>
                                            {formatCurrency(t.amount, wallet.currency)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                           Saldo: {formatCurrency(t.runningBalance, wallet.currency)}
                                        </div>
                                    </div>
                                </div>
                                {t.notes && (
                                    <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">{t.notes}</p>
                                )}
                            </Card>
                        )) : (
                            <div className="text-center text-muted-foreground py-10">
                                No se encontraron movimientos para los filtros seleccionados.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

    