'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, orderBy, query, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreVertical, Pencil, Trash2, Loader } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Transfer, type Wallet } from "@/lib/types";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};

export default function TransfersHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingTransfer, setDeletingTransfer] = React.useState<Transfer | null>(null);

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
      const walletsList = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
      setWallets(walletsList);

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
  
  const walletMap = new Map(wallets.map(w => [w.id, w]));

  const handleDeleteClick = (transfer: Transfer) => {
    setDeletingTransfer(transfer);
  };

  const confirmDelete = async () => {
    if (!deletingTransfer) return;

    const fromWalletRef = doc(db, 'wallets', deletingTransfer.fromWalletId);
    const toWalletRef = doc(db, 'wallets', deletingTransfer.toWalletId);
    const transferRef = doc(db, 'transfers', deletingTransfer.id);
    
    const batch = writeBatch(db);

    try {
        const fromWallet = wallets.find(w => w.id === deletingTransfer.fromWalletId);
        const toWallet = wallets.find(w => w.id === deletingTransfer.toWalletId);

        if (!fromWallet || !toWallet) {
            throw new Error("Una o ambas billeteras no fueron encontradas.");
        }
        
        // Revert balances
        const newFromBalance = fromWallet.balance + deletingTransfer.amountSent;
        const newToBalance = toWallet.balance - deletingTransfer.amountReceived;

        batch.update(fromWalletRef, { balance: newFromBalance });
        batch.update(toWalletRef, { balance: newToBalance });
        batch.delete(transferRef);

        await batch.commit();

        toast({ title: "Transferencia eliminada", description: `La transferencia ha sido eliminada y los saldos han sido revertidos.`, variant: "destructive" });
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
                  <TableHead>Tasa</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.length > 0 ? transfers.map(transfer => {
                    const fromWallet = walletMap.get(transfer.fromWalletId);
                    const toWallet = walletMap.get(transfer.toWalletId);
                    return (
                      <TableRow key={transfer.id}>
                          <TableCell>{format(new Date(transfer.date), 'PP', { locale: es })}</TableCell>
                          <TableCell>{fromWallet?.name ?? 'Billetera no encontrada'}</TableCell>
                          <TableCell>{toWallet?.name ?? 'Billetera no encontrada'}</TableCell>
                          <TableCell className="text-right font-medium text-red-500">
                              - {formatCurrency(transfer.amountSent, transfer.fromCurrency)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-500">
                              + {formatCurrency(transfer.amountReceived, transfer.toCurrency)}
                          </TableCell>
                          <TableCell>
                              {transfer.exchangeRate ? `1 USD = ${formatCurrency(transfer.exchangeRate, 'ARS')}` : 'N/A'}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">{transfer.notes}</TableCell>
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
                      No hay transferencias para mostrar.
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
        description="Esta acción revertirá los saldos en las billeteras afectadas y eliminará permanentemente la transferencia. ¿Estás seguro?"
      />
    </>
  );
}
