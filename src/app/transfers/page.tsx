
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Transfer, type Wallet } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from 'date-fns/locale';

async function getTransfers(): Promise<Transfer[]> {
  const transfersQuery = query(collection(db, 'transfers'), orderBy('date', 'desc'));
  const transfersSnapshot = await getDocs(transfersQuery);
  const transfersList = transfersSnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      date: data.date.toDate().toISOString(),
    } as Transfer;
  });
  return transfersList;
}

async function getWallets(): Promise<Wallet[]> {
    const walletsCol = collection(db, 'wallets');
    const walletsSnapshot = await getDocs(walletsCol);
    return walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
}

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
};


export default async function TransfersHistoryPage() {
  const [transfers, wallets] = await Promise.all([getTransfers(), getWallets()]);
  const walletMap = new Map(wallets.map(w => [w.id, w]));

  return (
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hacia</TableHead>
                <TableHead className="text-right">Monto Enviado</TableHead>
                <TableHead className="text-right">Monto Recibido</TableHead>
                <TableHead>Tasa de Cambio</TableHead>
                <TableHead>Notas</TableHead>
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
                    </TableRow>
                  )
                }) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    No hay transferencias para mostrar.
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
