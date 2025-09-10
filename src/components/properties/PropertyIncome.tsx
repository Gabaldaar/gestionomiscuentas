
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { type Income, type Wallet } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type PropertyIncomeProps = {
  incomes: Income[];
  wallets: Wallet[];
};

export function PropertyIncome({ incomes, wallets }: PropertyIncomeProps) {
  const { toast } = useToast();

  const getWalletName = (id: string) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? `${wallet.name} (${wallet.currency})` : "Desconocido";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ingresos</CardTitle>
        <Button onClick={() => toast({ title: "Funcionalidad no implementada" })}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Ingreso
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Billetera</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomes.length > 0 ? incomes.map(income => (
              <TableRow key={income.id}>
                <TableCell>{new Date(income.date).toLocaleDateString('es-ES')}</TableCell>
                <TableCell>
                  {getWalletName(income.walletId)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: income.currency }).format(income.amount)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No hay ingresos para mostrar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
