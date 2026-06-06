
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreVertical, Pencil, Trash2, Loader, Filter, ArrowRight, X, ArrowUp, ArrowDown, Calendar as CalendarIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Transfer, type Wallet, type Currency } from "@/lib/types";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SortableHeader, type SortConfig } from '@/components/shared/SortableHeader';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useAccount } from '@/components/context/AccountProvider';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

type TransferWithDetails = Transfer & { fromWalletName: string, toWalletName: string };

export default function TransfersHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { activeAccountId } = useAccount();
  const [transfers, setTransfers] = React.useState<TransferWithDetails[]>([]);
  const [wallets, setWallets] = React.useState<Map<string, Wallet>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [deletingTransfer, setDeletingTransfer] = React.useState<Transfer | null>(null);

  // Filter state
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedCurrency, setSelectedCurrency] = React.useState<Currency | 'all'>('all');
  const [fromWalletId, setFromWalletId] = React.useState<'all'>('all');
  const [toWalletId, setToWalletId] = React.useState<'all'>('all');
  const [sortConfig, setSortConfig] = React.useState<SortConfig<TransferWithDetails>>({ key: 'date', direction: 'desc' });


  const fetchTransfersAndWallets = React.useCallback(async () => {
    setLoading(true);
    try {
        const walletsCol = collection(db, 'wallets');
        const walletsSnapshot = await getDocs(walletsCol);
        const walletsMap = new Map<string, Wallet>();
        walletsSnapshot.docs.forEach(doc => {
            walletsMap.set(doc.id, { id: doc.id, ...doc.data() } as Wallet);
        });
        setWallets(walletsMap);

        const transfersQuery = query(collection(db, 'transfers'), orderBy('date', 'desc'));
        const transfersSnapshot = await getDocs(transfersQuery);
        const transfersList = transfersSnapshot.docs.map(doc => {
            const data = doc.data() as Transfer;
            return { 
            id: doc.id, 
            ...data,
            date: (data.date as any).toDate().toISOString(),
            fromWalletName: walletsMap.get(data.fromWalletId)?.name || 'N/A',
            toWalletName: walletsMap.get(data.toWalletId)?.name || 'N/A',
            } as TransferWithDetails;
        });
        setTransfers(transfersList);

    } catch (error) {
      console.error("Error fetching data: ", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTransfersAndWallets();
  }, [fetchTransfersAndWallets]);
  
  const handleDeleteClick = (transfer: Transfer) => {
    setDeletingTransfer(transfer);
  };
  
  const handleClearFilters = () => {
    setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    setSelectedCurrency('all');
    setFromWalletId('all');
    setToWalletId('all');
  };
  
  const areFiltersActive = React.useMemo(() => {
    const isDefaultDate = date?.from?.getTime() === startOfMonth(new Date()).getTime() && date?.to?.getTime() === endOfMonth(new Date()).getTime();

    return (
        !isDefaultDate ||
        selectedCurrency !== 'all' ||
        fromWalletId !== 'all' ||
        toWalletId !== 'all'
    );
  }, [date, selectedCurrency, fromWalletId, toWalletId]);


  const sortedAndFilteredTransfers = React.useMemo(() => {
    const walletsList = Array.from(wallets.values());
    const relevantWalletIds = activeAccountId === 'all' 
      ? new Set(walletsList.map(w => w.id))
      : new Set(walletsList.filter(w => !w.propertyIds || w.propertyIds.length === 0 || w.propertyIds.includes(activeAccountId)).map(w => w.id));

    let filtered = transfers.filter(transfer => {
      const transferDate = new Date(transfer.date);
      let match = true;
      
      if (!relevantWalletIds.has(transfer.fromWalletId) && !relevantWalletIds.has(transfer.toWalletId)) {
        match = false;
      }
      if (date?.from && transferDate < date.from) match = false;
      if (date?.to && transferDate > date.to) match = false;

      if (selectedCurrency !== 'all' && (transfer.fromCurrency !== selectedCurrency && transfer.toCurrency !== selectedCurrency)) match = false;
      if (fromWalletId !== 'all' && transfer.fromWalletId !== fromWalletId) match = false;
      if (toWalletId !== 'all' && transfer.toWalletId !== toWalletId) match = false;

      return match;
    });

    if (sortConfig) {
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
  }, [transfers, date, selectedCurrency, fromWalletId, toWalletId, sortConfig, activeAccountId, wallets]);


  const confirmDelete = async () => {
    if (!deletingTransfer) return;

    const fromWalletRef = doc(db, 'wallets', deletingTransfer.fromWalletId);
    const toWalletRef = doc(db, 'wallets', deletingTransfer.toWalletId);
    const transferRef = doc(db, 'transfers', deletingTransfer.id);
    
    const batch = writeBatch(db);

    try {
        const fromWalletSnap = await getDoc(fromWalletRef);
        const toWalletSnap = await getDoc(toWalletRef);

        if (fromWalletSnap.exists() && toWalletSnap.exists()) {
            const fromWallet = fromWalletSnap.data() as Wallet;
            const toWallet = toWalletSnap.data() as Wallet;
            
            // Revert balances only if both wallets exist
            const newFromBalance = fromWallet.balance + deletingTransfer.amountSent;
            const newToBalance = toWallet.balance - deletingTransfer.amountReceived;

            batch.update(fromWalletRef, { balance: newFromBalance });
            batch.update(toWalletRef, { balance: newToBalance });
            
            toast({ title: "Transferencia eliminada", description: `Los saldos de las billeteras han sido revertidos.`, variant: "destructive" });
        } else {
             toast({ title: "Transferencia eliminada", description: `El registro de la transferencia ha sido eliminado. No se revirtieron saldos porque una o ambas billeteras ya no existen.`, variant: "destructive", duration: 5000 });
        }
        
        // Always delete the transfer record
        batch.delete(transferRef);

        await batch.commit();

        setDeletingTransfer(null);
        fetchTransfersAndWallets(); // Refresh list
    } catch (error) {
      console.error("Error deleting transfer: ", error);
      toast({ title: "Error", description: "No se pudo eliminar la transferencia.", variant: "destructive" });
    }
  };

  const walletsList = Array.from(wallets.values());

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Historial de Transferencias">
          <Button asChild>
            <Link href="/transfers/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nueva Transferencia
            </Link>
          </Button>
        </PageHeader>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Filter className="h-5 w-5"/> Filtros</div>
                    {areFiltersActive && <Button variant="ghost" size="sm" onClick={handleClearFilters}><X className="mr-2 h-4 w-4"/>Limpiar Filtros</Button>}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 p-4">
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

                <Select value={fromWalletId} onValueChange={(value) => setFromWalletId(value)}>
                    <SelectTrigger className="w-full sm:w-auto grow">
                    <SelectValue placeholder="Desde Billetera" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las billeteras (Origen)</SelectItem>
                    {walletsList.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={toWalletId} onValueChange={(value) => setToWalletId(value)}>
                    <SelectTrigger className="w-full sm:w-auto grow">
                    <SelectValue placeholder="Hacia Billetera" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las billeteras (Destino)</SelectItem>
                    {walletsList.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                </Select>


                <Select value={selectedCurrency} onValueChange={(value: Currency | 'all') => setSelectedCurrency(value)}>
                    <SelectTrigger className="w-full sm:w-auto grow">
                    <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
                 <div className="flex justify-center items-center h-64">
                    <Loader className="h-8 w-8 animate-spin" />
                 </div>
            ) : (
              <>
                {/* Cards View */}
                <TooltipProvider>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-end gap-2 mb-4">
                      <Label htmlFor="sort-select" className="text-sm font-medium">Ordenar por:</Label>
                      <Select
                          value={sortConfig?.key as string}
                          onValueChange={(value) => {
                              setSortConfig({ key: value as keyof TransferWithDetails, direction: sortConfig?.direction || 'desc' });
                          }}
                      >
                          <SelectTrigger id="sort-select" className="w-auto h-9">
                              <SelectValue placeholder="Ordenar por" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="date">Fecha</SelectItem>
                              <SelectItem value="amountSent">Monto</SelectItem>
                              <SelectItem value="fromWalletName">Origen</SelectItem>
                              <SelectItem value="toWalletName">Destino</SelectItem>
                          </SelectContent>
                      </Select>
                      <Tooltip>
                          <TooltipTrigger asChild>
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
                          </TooltipTrigger>
                          <TooltipContent><p>Cambiar orden</p></TooltipContent>
                      </Tooltip>
                  </div>
                  {sortedAndFilteredTransfers.length > 0 ? sortedAndFilteredTransfers.map(transfer => {
                      const transferDate = new Date(transfer.date);
                      return (
                          <Card key={transfer.id} className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <p className="text-xs text-muted-foreground">{isValid(transferDate) ? format(transferDate, 'PP', { locale: es }) : 'Fecha inválida'}</p>
                                  </div>
                                  <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2">
                                              <MoreVertical className="h-4 w-4" />
                                          </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent>
                                          <DropdownMenuItem onClick={() => router.push(`/transfers/${transfer.id}/edit`)}>
                                              <Pencil className="mr-2 h-4 w-4" />
                                              Editar
                                          </DropdownMenuItem>
                                          <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(transfer)}>
                                              <Trash2 className="mr-2 h-4 w-4" />
                                              Eliminar
                                          </DropdownMenuItem>
                                      </DropdownMenuContent>
                                  </DropdownMenu>
                              </div>
                              
                              <div className="flex items-center justify-between gap-2 text-sm">
                                  <div className='text-center flex-1'>
                                      <p className="font-semibold truncate">{transfer.fromWalletName}</p>
                                      <p className="font-bold text-red-500">{formatCurrency(transfer.amountSent, transfer.fromCurrency)}</p>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0"/>
                                   <div className='text-center flex-1'>
                                      <p className="font-semibold truncate">{transfer.toWalletName}</p>
                                      <p className={cn("font-bold", {
                                          'text-green-600 dark:text-green-400': transfer.toCurrency === 'USD',
                                          'text-blue-600 dark:text-blue-400': transfer.toCurrency === 'ARS',
                                      })}>{formatCurrency(transfer.amountReceived, transfer.toCurrency)}</p>
                                  </div>
                              </div>
                              
                              {transfer.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{transfer.notes}</p>}
                          </Card>
                      )
                  }) : (
                      <div className="text-center text-muted-foreground py-10">
                           No hay transferencias para mostrar con los filtros seleccionados.
                      </div>
                  )}
                </div>
                </TooltipProvider>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDeleteDialog
        isOpen={!!deletingTransfer}
        onOpenChange={() => setDeletingTransfer(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar Transferencia?"
        description="Esta acción eliminará permanentemente la transferencia. Si las billeteras asociadas aún existen, sus saldos serán revertidos. ¿Estás seguro?"
      />
    </>
  );
}
