
'use client';

import * as React from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader, Coins, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { type Asset } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export default function AssetsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingAsset, setDeletingAsset] = React.useState<Asset | null>(null);

  const fetchAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const assetsQuery = query(collection(db, 'assets'), orderBy('creationDate', 'desc'));
      const assetsSnapshot = await getDocs(assetsQuery);
      const assetsList = assetsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Asset));
      setAssets(assetsList);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast({ title: "Error", description: "No se pudieron cargar los activos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleDeleteClick = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingAsset(asset);
  };

  const confirmDelete = async () => {
    if (!deletingAsset) return;

    const collectionsCol = collection(db, 'assets', deletingAsset.id, 'collections');
    const collectionsSnapshot = await getDocs(query(collectionsCol));

    if (!collectionsSnapshot.empty) {
        toast({
            title: "No se puede eliminar",
            description: "Este activo tiene cobranzas registradas. Debe eliminarlas primero desde la página de detalle del activo.",
            variant: "destructive",
            duration: 6000
        });
        setDeletingAsset(null);
        return;
    }

    try {
      await deleteDoc(doc(db, 'assets', deletingAsset.id));
      toast({ title: "Activo Eliminado", variant: "destructive" });
      setAssets(assets.filter(a => a.id !== deletingAsset.id));
      setDeletingAsset(null);
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el activo.", variant: "destructive" });
    }
  };

  return (
    <>
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Activos por Cobrar">
        <Button asChild>
          <Link href="/assets/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Activo
          </Link>
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader className="h-8 w-8 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Coins className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No tienes activos registrados</h3>
            <p className="mt-1 text-sm text-muted-foreground">Comienza añadiendo un préstamo que hayas otorgado u otra cuenta por cobrar.</p>
            <Button asChild className="mt-6">
              <Link href="/assets/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Activo
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assets.map(asset => {
            const percentagePaid = (asset.totalAmount - asset.outstandingBalance) / asset.totalAmount * 100;
            const currencyClass = cn({
              'text-green-600 dark:text-green-400': asset.currency === 'USD',
              'text-blue-600 dark:text-blue-400': asset.currency === 'ARS',
            });
            return (
                <Card key={asset.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className='flex-row justify-between items-start'>
                    <div>
                        <CardTitle>
                          <Link href={`/assets/${asset.id}`} className="hover:underline">
                            {asset.name}
                          </Link>
                        </CardTitle>
                        <CardDescription>
                          Total: <span className={cn('font-medium', currencyClass)}>{formatCurrency(asset.totalAmount, asset.currency)}</span>
                        </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); e.preventDefault(); router.push(`/assets/${asset.id}/edit`) }}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={(e) => handleDeleteClick(e, asset)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end">
                    <Link href={`/assets/${asset.id}`} className="block">
                      <div className="space-y-2">
                          <div>
                              <p className="text-sm font-medium">Saldo por Cobrar</p>
                              <p className={cn('text-2xl font-bold text-teal-500')}>
                                {formatCurrency(asset.outstandingBalance, asset.currency)}
                              </p>
                          </div>
                          <Progress value={percentagePaid} className="h-2" />
                          <p className="text-xs text-muted-foreground text-right">{percentagePaid.toFixed(1)}% cobrado</p>
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
        isOpen={!!deletingAsset}
        onOpenChange={() => setDeletingAsset(null)}
        onConfirm={confirmDelete}
        title={`¿Eliminar activo "${deletingAsset?.name}"?`}
        description="Esta acción es permanente y solo se puede realizar si el activo no tiene cobranzas registradas. ¿Estás seguro?"
    />
    </>
  );
}
