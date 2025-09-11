
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query, doc, deleteDoc, getDocsFromCache } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, HandCoins, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { type Liability } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export default function LiabilitiesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [liabilities, setLiabilities] = React.useState<Liability[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingLiability, setDeletingLiability] = React.useState<Liability | null>(null);


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
  
  const handleDeleteClick = (e: React.MouseEvent, liability: Liability) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingLiability(liability);
  };

  const confirmDelete = async () => {
    if (!deletingLiability) return;

    // Check for payments before deleting
    const paymentsCol = collection(db, 'liabilities', deletingLiability.id, 'payments');
    const paymentsSnapshot = await getDocs(query(paymentsCol));

    if (!paymentsSnapshot.empty) {
        toast({
            title: "No se puede eliminar",
            description: "Este pasivo tiene pagos registrados. Debe eliminarlos primero desde la página de detalle del pasivo.",
            variant: "destructive",
            duration: 6000
        });
        setDeletingLiability(null);
        return;
    }

    try {
      await deleteDoc(doc(db, 'liabilities', deletingLiability.id));
      toast({ title: "Pasivo Eliminado", variant: "destructive" });
      setLiabilities(liabilities.filter(l => l.id !== deletingLiability.id));
      setDeletingLiability(null);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el pasivo.", variant: "destructive" });
    }
  };

  return (
    <>
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
            const currencyClass = cn({
              'text-green-600 dark:text-green-400': liability.currency === 'USD',
              'text-blue-600 dark:text-blue-400': liability.currency === 'ARS',
            });
            return (
                <Card key={liability.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className='flex-row justify-between items-start'>
                    <div>
                        <CardTitle>
                          <Link href={`/liabilities/${liability.id}`} className="hover:underline">
                            {liability.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>
                          Total: <span className={cn('font-medium', currencyClass)}>{formatCurrency(liability.totalAmount, liability.currency)}</span>
                        </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); e.preventDefault(); router.push(`/liabilities/${liability.id}/edit`) }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => handleDeleteClick(e, liability)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end">
                    <Link href={`/liabilities/${liability.id}`} className="block">
                      <div className="space-y-2">
                          <div>
                              <p className="text-sm font-medium">Saldo Pendiente</p>
                              <p className={cn('text-2xl font-bold text-destructive')}>
                                {formatCurrency(liability.outstandingBalance, liability.currency)}
                              </p>
                          </div>
                          <Progress value={percentagePaid} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right">{percentagePaid.toFixed(1)}% pagado</p>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
            )
          })}
        </div>
      )}
    </div>
    <ConfirmDeleteDialog
        isOpen={!!deletingLiability}
        onOpenChange={() => setDeletingLiability(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar pasivo "${deletingLiability?.name}"?`}
        description="Esta acción es permanente y solo se puede realizar si el pasivo no tiene pagos registrados. ¿Estás seguro?"
    />
    </>
  );
}
