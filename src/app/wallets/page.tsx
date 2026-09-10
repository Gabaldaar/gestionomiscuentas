'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, deleteDoc, query, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreVertical, Pencil, Trash2, Loader, DollarSign, CircleDollarSign, ArrowLeftRight, LineChart as LineChartIcon, X, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Wallet, type Currency, type Income, type ActualExpense, type Transfer, type Property } from '@/lib/types';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';
import { WalletIcon, type WalletIconName } from '@/lib/wallet-icons';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAccount } from '@/components/context/AccountProvider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const formatCurrency = (amount: number | null | undefined, currency?: string | null, digits: number = 2) => {
  const safeCurrency = (currency === 'USD' || currency === 'ARS') ? currency : 'ARS';
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency, minimumFractionDigits: digits }).format(safeAmount);
  } catch {
    return `${safeCurrency === 'USD' ? 'US$' : '$'} ${safeAmount.toFixed(digits)}`;
  }
};

// --- Componente interno para el gráfico de evolución ---

type ChartDataPoint = {
  month: string;
  balance: number;
};

type EvolutionChartProps = {
  data: ChartDataPoint[];
  currency: Currency;
};

function EvolutionChart({ data, currency }: EvolutionChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
          <XAxis 
            dataKey="month" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatCurrency(value, currency).replace('$', '$ ')}
          />
          <RechartsTooltip 
            formatter={(value: number) => [formatCurrency(value, currency), "Saldo"]}
            contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--background))' }}
          />
          <Line 
            type="monotone" 
            dataKey="balance" 
            stroke={currency === 'USD' ? '#10b981' : '#3b82f6'} 
            strokeWidth={3} 
            dot={{ r: 4, fill: currency === 'USD' ? '#10b981' : '#3b82f6' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WalletsSettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { activeAccountId, setActiveAccountId, properties } = useAccount();
  
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingWallet, setDeletingWallet] = React.useState<Wallet | null>(null);
  const [currencyFilter, setCurrencyFilter] = React.useState<'all' | Currency>('all');
  const [selectedWallets, setSelectedWallets] = React.useState<string[]>([]);

  // Estado para la evolución histórica
  const [isEvolutionVisible, setIsEvolutionVisible] = React.useState(false);
  const [loadingEvolution, setLoadingEvolution] = React.useState(false);
  const [evolutionData, setEvolutionData] = React.useState<{ [key in Currency]?: ChartDataPoint[] }>({});

  const fetchWallets = React.useCallback(async () => {
    setLoading(true);
    try {
        const walletsQuery = query(collection(db, 'wallets'));
        const walletsSnapshot = await getDocs(walletsQuery);
        const walletsList = walletsSnapshot.docs
            .map(doc => {
              const data = doc.data();
              const propId = data.propertyId || data.propertyIds?.[0] || '';
              const rawCurrency = data.currency;
              const safeCurrency: Currency = (rawCurrency === 'USD' || rawCurrency === 'ARS') ? rawCurrency : 'ARS';
              return { 
                id: doc.id, 
                ...data,
                currency: safeCurrency,
                balance: typeof data.balance === 'number' && !isNaN(data.balance) ? data.balance : 0,
                propertyId: propId,
              } as Wallet;
            })
            .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        setWallets(walletsList);
    } catch (error) {
        console.error("Error fetching wallets: ", error);
        toast({ title: "Error", description: "No se pudieron cargar las billeteras.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const propertiesMap = React.useMemo(() => {
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  const activeProperty = React.useMemo(() => {
    return properties.find(p => p.id === activeAccountId);
  }, [properties, activeAccountId]);

  const handleDeleteClick = (e: React.MouseEvent, wallet: Wallet) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingWallet(wallet);
  };

  const confirmDelete = async () => {
    if (!deletingWallet) return;
    try {
      await deleteDoc(doc(db, 'wallets', deletingWallet.id));
      toast({ title: "Billetera eliminada", description: `La billetera "${deletingWallet.name}" ha sido eliminada.`, variant: "destructive" });
      setDeletingWallet(null);
      fetchWallets();
    } catch (error) {
      console.error("Error deleting wallet: ", error);
      toast({ title: "Error", description: "No se pudo eliminar la billetera.", variant: "destructive" });
    }
  };
  
  const renderIcon = (wallet: Wallet) => {
    const iconClass = cn('h-6 w-6', {
        'text-green-700 dark:text-green-300': wallet.currency === 'USD',
        'text-blue-700 dark:text-blue-300': wallet.currency === 'ARS',
    });
    if (wallet.icon) {
        return <WalletIcon name={wallet.icon as WalletIconName} className={iconClass} />;
    }
    return wallet.currency === 'USD' ? <DollarSign className={iconClass} /> : <CircleDollarSign className={iconClass} />;
  };

  // Filtrado estricto por cuenta y por moneda
  const filteredWallets = React.useMemo(() => {
    return wallets.filter(wallet => {
      if (currencyFilter !== 'all' && wallet.currency !== currencyFilter) {
        return false;
      }
      if (activeAccountId !== 'all') {
        const walletPropId = wallet.propertyId || wallet.propertyIds?.[0];
        if (walletPropId !== activeAccountId) {
          return false;
        }
      }
      return true;
    });
  }, [wallets, currencyFilter, activeAccountId]);
  
  const walletTotals = React.useMemo(() => {
    const totals: { ARS: number; USD: number } = { ARS: 0, USD: 0 };
    filteredWallets.forEach(wallet => {
      const curr = (wallet.currency === 'USD' || wallet.currency === 'ARS') ? wallet.currency : 'ARS';
      totals[curr] = (totals[curr] || 0) + (wallet.balance || 0);
    });
    return totals;
  }, [filteredWallets]);

  const handleWalletSelection = (e: React.MouseEvent, walletId: string) => {
    e.stopPropagation();
    setSelectedWallets(prev => {
      const isSelected = prev.includes(walletId);
      const next = isSelected ? prev.filter(id => id !== walletId) : [...prev, walletId];
      if (next.length === 0) setIsEvolutionVisible(false);
      return next;
    });
  };

  const selectedTotals = React.useMemo(() => {
    const totals: { [key in Currency]?: number } = {};
    selectedWallets.forEach(id => {
        const wallet = wallets.find(w => w.id === id);
        if (wallet) {
            const curr: Currency = (wallet.currency === 'USD' || wallet.currency === 'ARS') ? wallet.currency : 'ARS';
            if (totals[curr] === undefined) {
                totals[curr] = 0;
            }
            totals[curr]! += (wallet.balance || 0);
        }
    });
    return totals;
  }, [selectedWallets, wallets]);

  const calculateEvolution = async () => {
    if (selectedWallets.length === 0) return;
    
    setLoadingEvolution(true);
    setIsEvolutionVisible(true);

    try {
      const selectedWalletIds = new Set(selectedWallets);
      const selectedWalletsData = wallets.filter(w => selectedWalletIds.has(w.id));

      const [incomesSnap, expensesSnap, transfersSnap] = await Promise.all([
        getDocs(query(collectionGroup(db, 'incomes'))),
        getDocs(query(collectionGroup(db, 'actualExpenses'))),
        getDocs(query(collection(db, 'transfers'), orderBy('date', 'desc')))
      ]);

      const transactions: { date: Date, amount: number, currency: Currency }[] = [];

      incomesSnap.docs
        .filter(doc => doc.ref.parent.parent && !doc.ref.parent.parent.parent)
        .forEach(doc => {
          const data = doc.data() as Income;
          if (selectedWalletIds.has(data.walletId)) {
            let dateObj = new Date();
            try {
              if ((data.date as any)?.toDate) dateObj = (data.date as any).toDate();
              else if (data.date) dateObj = new Date(data.date);
            } catch {}
            transactions.push({ date: dateObj, amount: data.amount, currency: data.currency });
          }
        });

      expensesSnap.docs
        .filter(doc => doc.ref.parent.parent && !doc.ref.parent.parent.parent)
        .forEach(doc => {
          const data = doc.data() as ActualExpense;
          if (selectedWalletIds.has(data.walletId)) {
            let dateObj = new Date();
            try {
              if ((data.date as any)?.toDate) dateObj = (data.date as any).toDate();
              else if (data.date) dateObj = new Date(data.date);
            } catch {}
            transactions.push({ date: dateObj, amount: -data.amount, currency: data.currency });
          }
        });

      transfersSnap.docs.forEach(doc => {
        const data = doc.data() as Transfer;
        let dateObj = new Date();
        try {
          if ((data.date as any)?.toDate) dateObj = (data.date as any).toDate();
          else if (data.date) dateObj = new Date(data.date);
        } catch {}
        if (selectedWalletIds.has(data.fromWalletId)) {
          transactions.push({ date: dateObj, amount: -data.amountSent, currency: data.fromCurrency });
        }
        if (selectedWalletIds.has(data.toWalletId)) {
          transactions.push({ date: dateObj, amount: data.amountReceived, currency: data.toCurrency });
        }
      });

      const currencies: Currency[] = ['ARS', 'USD'];
      const newEvolutionData: { [key in Currency]?: ChartDataPoint[] } = {};
      const now = new Date();

      currencies.forEach(curr => {
        const walletsOfCurrency = selectedWalletsData.filter(w => w.currency === curr);
        if (walletsOfCurrency.length === 0) return;

        let currentRunningBalance = walletsOfCurrency.reduce((sum, w) => sum + w.balance, 0);
        const monthlyPoints: ChartDataPoint[] = [];

        for (let i = 0; i < 12; i++) {
          const monthDate = subMonths(now, i);
          const monthEnd = endOfMonth(monthDate);

          const movementsAfterThisMonth = transactions
            .filter(t => t.currency === curr && t.date > monthEnd)
            .reduce((sum, t) => sum + t.amount, 0);

          const balanceAtEndOfMonth = currentRunningBalance - movementsAfterThisMonth;

          monthlyPoints.push({
            month: format(monthDate, 'MMM yy', { locale: es }),
            balance: balanceAtEndOfMonth
          });
        }

        newEvolutionData[curr] = monthlyPoints.reverse();
      });

      setEvolutionData(newEvolutionData);

    } catch (error) {
      console.error("Error calculando evolución:", error);
      toast({ title: "Error", description: "No se pudo calcular la evolución histórica.", variant: "destructive" });
    } finally {
      setLoadingEvolution(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Billeteras y Cajas">
        <Button asChild variant="outline">
          <Link href="/transfers/new">
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Nueva Transferencia
          </Link>
        </Button>
        <Button asChild>
          <Link href="/wallets/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nueva Billetera
          </Link>
        </Button>
      </PageHeader>

      {/* Currency Tabs */}
      <Tabs defaultValue="all" onValueChange={(value) => setCurrencyFilter(value as 'all' | Currency)}>
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="ARS">Pesos (ARS)</TabsTrigger>
          <TabsTrigger value="USD">Dólares (USD)</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Totals Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {(['ARS', 'USD'] as Currency[])
          .filter(currency => currencyFilter === 'all' || currencyFilter === currency)
          .map(currency => (
          <Card key={currency} className={cn(
            "border-none shadow-sm",
            currency === 'USD' ? 'bg-green-500/10' : 'bg-blue-500/10'
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total {currency} {activeAccountId !== 'all' ? `(${activeProperty?.name})` : ''}
              </CardTitle>
              {currency === 'USD' ? <DollarSign className="h-4 w-4 text-green-600" /> : <CircleDollarSign className="h-4 w-4 text-blue-600" />}
            </CardHeader>
            <CardContent>
              <div className={cn(
                  "text-2xl font-bold",
                  currency === 'USD' ? 'text-green-700 dark:text-green-400' : 'text-blue-700 dark:text-blue-400'
              )}>
                {formatCurrency(walletTotals[currency] ?? 0, currency, 2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredWallets.filter(w => w.currency === currency).length} billetera(s)
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Combined Selection Box */}
      {selectedWallets.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Selección Combinada</CardTitle>
              <CardDescription>Suma de las {selectedWallets.length} billeteras marcadas</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedWallets([])}>
                <X className="mr-2 h-4 w-4" /> Limpiar
              </Button>
              <Button size="sm" onClick={calculateEvolution} disabled={loadingEvolution}>
                {loadingEvolution ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <LineChartIcon className="mr-2 h-4 w-4" />}
                {isEvolutionVisible ? 'Actualizar Evolución' : 'Analizar Evolución'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(selectedTotals) as Currency[]).map(currency => (
                <div key={currency} className="flex justify-between items-center p-3 rounded-lg bg-background border">
                  <span className="font-semibold text-sm">{currency}:</span>
                  <span className={cn("font-bold text-xl", {
                    'text-green-600 dark:text-green-400': currency === 'USD',
                    'text-blue-600 dark:text-blue-400': currency === 'ARS',
                  })}>
                    {formatCurrency(selectedTotals[currency] ?? 0, currency, 2)}
                  </span>
                </div>
              ))}
            </div>

            {isEvolutionVisible && (
              <div className="pt-4 border-t space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                {loadingEvolution ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Analizando transacciones históricas...</p>
                  </div>
                ) : (
                  <>
                    {Object.entries(evolutionData).map(([curr, data]) => (
                      <div key={curr} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold flex items-center gap-2">
                            <LineChartIcon className="h-4 w-4 text-primary" />
                            Evolución combinada en {curr}
                          </h4>
                          <span className="text-xs text-muted-foreground">Últimos 12 meses</span>
                        </div>
                        <EvolutionChart data={data!} currency={curr as Currency} />
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Wallets Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredWallets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWallets.map((wallet) => {
            const isSelected = selectedWallets.includes(wallet.id);
            const walletPropId = wallet.propertyId || wallet.propertyIds?.[0];
            const propertyOfWallet = walletPropId ? propertiesMap.get(walletPropId) : null;

            return (
              <div key={wallet.id} className="relative group">
                <div className="absolute top-3 right-3 z-10" onClick={(e) => handleWalletSelection(e, wallet.id)}>
                  <Checkbox
                    checked={isSelected}
                    className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-sm"
                  />
                </div>
                <Link href={`/wallets/${wallet.id}`} className="block transition-all hover:scale-[1.01]">
                  <Card className={cn(
                    "h-full transition-colors shadow-sm",
                    isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "hover:border-primary/50"
                  )}>
                    <CardHeader className="flex flex-row items-start justify-between pb-2 pr-10">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-md", {
                          'bg-green-100 dark:bg-green-900': wallet.currency === 'USD',
                          'bg-blue-100 dark:bg-blue-900': wallet.currency === 'ARS',
                        })}>
                          {renderIcon(wallet)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-semibold truncate">{wallet.name}</CardTitle>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1 uppercase">
                              {wallet.currency}
                            </Badge>
                            {propertyOfWallet && (
                              <Badge variant="secondary" className="text-[10px] font-normal py-0 px-1.5 gap-1">
                                {propertyOfWallet.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-6 -mt-1" onClick={(e) => {e.stopPropagation(); e.preventDefault();}}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {e.stopPropagation(); e.preventDefault(); router.push(`/wallets/${wallet.id}/edit`)}}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => handleDeleteClick(e, wallet)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-xs text-muted-foreground mb-0.5">Saldo disponible</div>
                      <div className={cn("text-2xl font-bold", {
                        'text-green-600 dark:text-green-400': wallet.currency === 'USD',
                        'text-blue-600 dark:text-blue-400': wallet.currency === 'ARS',
                        'text-destructive': wallet.balance < 0,
                      })}>
                        {formatCurrency(wallet.balance, wallet.currency, 2)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground space-y-3">
            <p className="text-base font-medium">
              {activeAccountId === 'all' 
                ? 'No hay billeteras registradas.'
                : `No hay billeteras asociadas a "${activeProperty?.name || 'esta cuenta'}".`
              }
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {activeAccountId !== 'all'
                ? 'Puedes añadir una nueva billetera para esta cuenta o cambiar el filtro a "Todas las cuentas".'
                : 'Haz clic en "Nueva Billetera" para crear una.'
              }
            </p>
            <Button asChild className="mt-2">
              <Link href="/wallets/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Nueva Billetera
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        isOpen={!!deletingWallet}
        onOpenChange={() => setDeletingWallet(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar Billetera?"
        description={`¿Estás seguro de que quieres eliminar la billetera "${deletingWallet?.name}"? Esta acción es permanente y no se puede deshacer.`}
      />
    </div>
  );
}
