
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { type Liability } from "@/lib/types";

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export default function LiabilitiesPage() {
  const { toast } = useToast();
  const [liabilities, setLiabilities] = React.useState<Liability[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchLiabilities = React.useCallback(async () => {
    setLoading(true);
    try {
      const liabilitiesQuery = query(collection(db, 'liabilities'), orderBy('creationDate', 'desc'));
      const liabilitiesSnapshot = await getDocs(liabilitiesQuery);
      const liabilitiesList = liabilitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Liability));
      setLiabilities(liabilitiesList);
    } catch (error) {
      console.error("Error fetching liabilities:", error);
      toast({ title: "Error", description: "No se pudieron cargar los pasivos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchLiabilities();
  }, [fetchLiabilities]);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Pasivos y Deudas">
        <Button asChild>
          <Link href="/liabilities/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Pasivo
          </Link>
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader className="h-8 w-8 animate-spin" />
        </div>
      ) : liabilities.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <HandCoins className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No tienes pasivos registrados</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comienza añadiendo un préstamo, crédito o cualquier otra deuda.</p>
            <Button asChild className="mt-6">
              <Link href="/liabilities/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Pasivo
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {liabilities.map(liability => {
            const percentagePaid = (liability.totalAmount - liability.outstandingBalance) / liability.totalAmount * 100;
            return (
              <Link key={liability.id} href={`/liabilities/${liability.id}`} className="block transition-all hover:scale-[1.02]">
                <Card className="h-full flex flex-col">
                  <CardHeader>
                    <CardTitle>{liability.name}</CardTitle>
                    <CardDescription>
                      Total: {formatCurrency(liability.totalAmount, liability.currency)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end">
                    <div className="space-y-2">
                        <div>
                            <p className="text-sm font-medium">Saldo Pendiente</p>
                            <p className="text-2xl font-bold">{formatCurrency(liability.outstandingBalance, liability.currency)}</p>
                        </div>
                        <Progress value={percentagePaid} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{percentagePaid.toFixed(1)}% pagado</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  );
}
