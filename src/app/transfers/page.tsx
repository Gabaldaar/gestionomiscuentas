
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query, doc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreVertical, Pencil, Trash2, Loader, Calendar as CalendarIcon, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Transfer, type Wallet, type Currency } from "@/lib/types";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { type DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';


const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

export default function TransfersHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [wallets, setWallets] = React.useState<Map<string, Wallet>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [deletingTransfer, setDeletingTransfer] = React.useState<Transfer | null>(null);

  // Filter state
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
  const [selectedCurrency, setSelectedCurrency] = React.useState<Currency | 'all'>('all');
  const [activeFilters, setActiveFilters] = React.useState<{dateRange: DateRange | undefined, currency: Currency | 'all'}>({dateRange: undefined, currency: 'all'});


  const fetchTransfersAndWallets = React.useCallback(async () => {
    setLoading(true);
    try {
      const transfersQuery = query(collection(db, 'transfers'), orderBy('date', 'desc'));
      const transfersSnapshot = await getDocs(transfersQuery);
      const transfersList = transfersSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: (data.date as any).toDate().toISOString(),
        } as Transfer;
      });
      setTransfers(transfersList);

      const walletsCol = collection(db, 'wallets');
      const walletsSnapshot = await getDocs(walletsCol);
      const walletsMap = new Map<string, Wallet>();
      walletsSnapshot.docs.forEach(doc => {
          walletsMap.set(doc.id, { id: doc.id, ...doc.data() } as Wallet);
      });
      setWallets(walletsMap);

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
  
  const handleApplyFilters = () => {
    setActiveFilters({ dateRange, currency: selectedCurrency });
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setSelectedCurrency('all');
    setActiveFilters({ dateRange: undefined, currency: 'all' });
  };
  
  const filteredTransfers = React.useMemo(() => {
    return transfers.filter(transfer => {
      const transferDate = new Date(transfer.date);
      const { dateRange: activeDateRange, currency: activeCurrency } = activeFilters;

      // Date range filter
      if (activeDateRange?.from && activeDateRange?.to) {
        if (transferDate < activeDateRange.from || transferDate > activeDateRange.to) {
          return false;
        }
      }

      // Currency filter
      if (activeCurrency !== 'all') {
        if (transfer.fromCurrency !== activeCurrency && transfer.toCurrency !== activeCurrency) {
          return false;
        }
      }

      return true;
    });
  }, [transfers, activeFilters]);


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
            <CardContent className="p-4 flex flex-wrap items-center gap-2">
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

                <Select value={selectedCurrency} onValueChange={(value: Currency | 'all') => setSelectedCurrency(value)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex w-full sm:w-auto gap-2">
                    <Button onClick={handleApplyFilters} className="flex-1">
                        <Filter className="mr-2 h-4 w-4" />
                        Aplicar
                    </Button>
                    <Button variant="ghost" onClick={handleClearFilters} className="flex-1">
                        Limpiar
                    </Button>
                </div>

            </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
                 <div className="flex justify-center items-center h-64">
                    <Loader className="h-8 w-8 animate-spin" />
                 </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Hacia</TableHead>
                  <TableHead className="text-right">Monto Enviado</TableHead>
                  <TableHead className="text-right">Monto Recibido</TableHead>
                  <TableHead className="hidden md:table-cell">Tasa</TableHead>
                  <TableHead className="hidden md:table-cell">Notas</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.length > 0 ? filteredTransfers.map(transfer => {
                    const fromWallet = wallets.get(transfer.fromWalletId);
                    const toWallet = wallets.get(transfer.toWalletId);
                    const transferDate = new Date(transfer.date);
                    return (
                      <TableRow key={transfer.id}>
                          <TableCell>{isValid(transferDate) ? format(transferDate, 'PP', { locale: es }) : 'Fecha inválida'}</TableCell>
                          <TableCell>{fromWallet?.name ?? <span className="text-muted-foreground italic">Billetera no encontrada</span>}</TableCell>
                          <TableCell>{toWallet?.name ?? <span className="text-muted-foreground italic">Billetera no encontrada</span>}</TableCell>
                          <TableCell className="text-right font-medium text-red-500">
                              - {formatCurrency(transfer.amountSent, transfer.fromCurrency)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-500">
                              + {formatCurrency(transfer.amountReceived, transfer.toCurrency)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                              {transfer.exchangeRate ? `1 USD = ${formatCurrency(transfer.exchangeRate, 'ARS')}` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">{transfer.notes}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
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
                          </TableCell>
                      </TableRow>
                    )
                  }) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No hay transferencias para mostrar con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
