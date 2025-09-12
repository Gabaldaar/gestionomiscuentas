'use client';

import * as React from 'react';
import { useParams, useRouter, notFound } from 'next/navigation';
import { collection, getDocs, doc, getDoc, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader, AlertTriangle, ArrowDown, ArrowUp, ArrowRightLeft, Pencil, Filter, Calendar as CalendarIcon, DollarSign, CircleDollarSign } from 'lucide-react';
import { type Wallet, type Transaction, type ActualExpense, type Income, type Transfer, type Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { WalletIcon, type WalletIconName } from '@/lib/wallet-icons';
import { type DateRange } from 'react-day-picker';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};


async function getAllTransactionsForWallet(walletId: string): Promise<{transactions: Transaction[], properties: Map<string, string>}> {
    const transactions: Transaction[] = [];
    const propertiesMap = new Map<string, string>();

    // 1. Fetch all properties to get their names
    const propsCol = collection(db, 'properties');
    const propsSnap = await getDocs(propsCol);
    propsSnap.docs.forEach(doc => {
      propertiesMap.set(doc.id, (doc.data() as Property).name);
    });

    // 2. Fetch all incomes and expenses from all properties
    for (const [propId, propName] of propertiesMap.entries()) {
        const incomesCol = collection(db, 'properties', propId, 'incomes');
        const incomesSnap = await getDocs(query(incomesCol));
        incomesSnap.forEach(doc => {
            const income = { id: doc.id, ...doc.data() } as Income;
            if (income.walletId === walletId) {
                transactions.push({
                    id: `income-${doc.id}`,
                    date: (income.date as any).toDate(),
                    type: 'income',
                    amount: income.amount,
                    currency: income.currency,
                    description: 'Ingreso',
                    relatedEntity: propName,
                    notes: income.notes
                });
            }
        });

        const expensesCol = collection(db, 'properties', propId, 'actualExpenses');
        const expensesSnap = await getDocs(query(expensesCol));
        expensesSnap.forEach(doc => {
            const expense = { id: doc.id, ...doc.data() } as ActualExpense;
            if (expense.walletId === walletId) {
                transactions.push({
                    id: `expense-${doc.id}`,
                    date: (expense.date as any).toDate(),
                    type: 'expense',
                    amount: -expense.amount,
                    currency: expense.currency,
                    description: 'Gasto',
                    relatedEntity: propName,
                    notes: expense.notes
                });
            }
        });
    }

    // 3. Fetch all transfers
    const transfersCol = collection(db, 'transfers');
    const transfersSnap = await getDocs(query(transfersCol));
    const walletsSnap = await getDocs(collection(db, 'wallets'));
    const walletsMap = new Map(walletsSnap.docs.map(d => [d.id, d.data().name]));

    transfersSnap.forEach(doc => {
        const transfer = { id: doc.id, ...doc.data() } as Transfer;
        const date = (transfer.date as any).toDate();

        if (transfer.fromWalletId === walletId) {
            transactions.push({
                id: `transfer-out-${doc.id}`,
                date,
                type: 'transfer_out',
                amount: -transfer.amountSent,
                currency: transfer.fromCurrency,
                description: 'Transferencia Enviada',
                relatedEntity: `a ${walletsMap.get(transfer.toWalletId) ?? 'otra billetera'}`,
                notes: transfer.notes
            });
        }
        if (transfer.toWalletId === walletId) {
             transactions.push({
                id: `transfer-in-${doc.id}`,
                date,
                type: 'transfer_in',
                amount: transfer.amountReceived,
                currency: transfer.toCurrency,
                description: 'Transferencia Recibida',
                relatedEntity: `de ${walletsMap.get(transfer.fromWalletId) ?? 'otra billetera'}`,
                notes: transfer.notes
            });
        }
    });

    return { transactions: transactions.sort((a, b) => b.date.getTime() - a.date.getTime()), properties: propertiesMap };
}


export default function WalletDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    
    const [wallet, setWallet] = React.useState<Wallet | null>(null);
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Filters
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
    const [descriptionFilter, setDescriptionFilter] = React.useState('');


    React.useEffect(() => {
        if (!id) return;

        const fetchWalletData = async () => {
            setLoading(true);
            setError(null);
            try {
                const walletRef = doc(db, 'wallets', id);
                const walletSnap = await getDoc(walletRef);

                if (walletSnap.exists()) {
                    setWallet({ id: walletSnap.id, ...walletSnap.data() } as Wallet);
                    const { transactions } = await getAllTransactionsForWallet(id);
                    setTransactions(transactions);
                } else {
                    setError('Billetera no encontrada.');
                }
            } catch (err) {
                console.error("Error fetching wallet data:", err);
                setError('No se pudo cargar la información de la billetera.');
            } finally {
                setLoading(false);
            }
        };

        fetchWalletData();
    }, [id]);
    
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
            return match;
        });
    }, [transactions, dateRange, descriptionFilter]);

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
            case 'income': return <ArrowUp className="h-4 w-4 text-green-500" />;
            case 'expense': return <ArrowDown className="h-4 w-4 text-red-500" />;
            case 'transfer_in':
            case 'transfer_out': return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
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
                <Button asChild variant="outline">
                    <Link href={`/wallets/${wallet.id}/edit`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar Billetera
                    </Link>
                </Button>
            </PageHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader className="flex flex-row items-center gap-4">
                        <div className={cn("p-3 rounded-lg", {
                            'bg-green-100 dark:bg-green-900': wallet.currency === 'USD',
                            'bg-blue-100 dark:bg-blue-900': wallet.currency === 'ARS',
                        })}>
                           {renderIcon(wallet)}
                        </div>
                        <div>
                            <CardDescription>Saldo Actual</CardDescription>
                            <CardTitle className={cn("text-3xl", {
                                'text-green-600 dark:text-green-400': wallet.currency === 'USD',
                                'text-blue-600 dark:text-blue-400': wallet.currency === 'ARS',
                                'text-destructive': wallet.balance < 0,
                            })}>
                                {formatCurrency(wallet.balance, wallet.currency)}
                            </CardTitle>
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
                         <Button onClick={() => { setDateRange(undefined); setDescriptionFilter(''); }}>
                            <Filter className="mr-2 h-4 w-4" /> Limpiar
                         </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Relacionado con</TableHead>
                                <TableHead className="hidden md:table-cell">Notas</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{transactionIcon(t.type)}</TableCell>
                                    <TableCell>{format(t.date, 'PP', { locale: es })}</TableCell>
                                    <TableCell className="font-medium">{t.description}</TableCell>
                                    <TableCell>{t.relatedEntity}</TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell max-w-xs truncate">{t.notes}</TableCell>
                                    <TableCell className={cn("text-right font-semibold", t.amount > 0 ? "text-green-500" : "text-red-500")}>
                                        {formatCurrency(t.amount, wallet.currency)}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">
                                        No se encontraron movimientos para los filtros seleccionados.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
