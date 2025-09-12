
'use client';

import * as React from 'react';
import { notFound, useRouter, useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, Timestamp, query, orderBy, writeBatch, deleteDoc, where, collectionGroup } from 'firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Loader, PlusCircle, Trash2, Coins } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Asset, type AssetCollection, type Wallet, type Property, type IncomeCategory, type Expense } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AddIncomeDialog, type IncomeFormValues } from '@/components/properties/AddIncomeDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';


const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export default function AssetDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const router = useRouter();

  const [asset, setAsset] = React.useState<Asset | null>(null);
  const [collections, setCollections] = React.useState<AssetCollection[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [incomeCategories, setIncomeCategories] = React.useState<IncomeCategory[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAddCollectionOpen, setIsAddCollectionOpen] = React.useState(false);

  const [deletingCollection, setDeletingCollection] = React.useState<AssetCollection | null>(null);
  const [isDeleteAssetOpen, setIsDeleteAssetOpen] = React.useState(false);
  const [collectionDialogInitialData, setCollectionDialogInitialData] = React.useState<Partial<IncomeFormValues> | null>(null);

  const fetchPageData = React.useCallback(async () => {
    setLoading(true);
    try {
      const assetRef = doc(db, "assets", id);
      const assetSnap = await getDoc(assetRef);

      if (!assetSnap.exists()) {
        notFound();
        return;
      }
      const assetData = { id: assetSnap.id, ...assetSnap.data() } as Asset;
      setAsset(assetData);

      const [collectionsSnap, walletsSnap, propertiesSnap, incomeCatSnap] = await Promise.all([
        getDocs(query(collection(db, "assets", id, "collections"), orderBy("date", "desc"))),
        getDocs(query(collection(db, "wallets"))),
        getDocs(query(collection(db, "properties"))),
        getDocs(query(collection(db, 'incomeCategories'), orderBy('name'))),
      ]);
      
      setCollections(collectionsSnap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date as Timestamp).toDate().toISOString() } as AssetCollection)));
      setWallets(walletsSnap.docs.map(d => ({ id: d.id, ...d.data()} as Wallet)));
      setProperties(propertiesSnap.docs.map(d => ({ id: d.id, ...d.data()} as Property)));
      
      const incomeCategoriesList = await Promise.all(incomeCatSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'incomeCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
      }));
      setIncomeCategories(incomeCategoriesList);

    } catch (error) {
      console.error("Error fetching asset data:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos del activo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);


  const handleCollectionSubmit = async (data: IncomeFormValues) => {
    if (!asset) return;

    const propertyId = (data as any).propertyId;
    if (!propertyId) {
        toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el ingreso del cobro.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
        const incomeRef = doc(collection(db, 'properties', propertyId, 'incomes'));
        const incomeData = { ...data, date: Timestamp.fromDate(data.date), propertyId, assetId: asset.id };
        batch.set(incomeRef, incomeData);

        const collectionRef = doc(collection(db, 'assets', id, 'collections'));
        const collectionData = {
            assetId: id,
            date: Timestamp.fromDate(data.date),
            amount: data.amount,
            walletId: data.walletId,
            currency: data.currency,
            notes: data.notes,
            incomeId: incomeRef.id,
            propertyId: propertyId,
        };
        batch.set(collectionRef, collectionData);

        const walletRef = doc(db, 'wallets', data.walletId);
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("Billetera no encontrada");
        const walletData = walletSnap.data();
        batch.update(walletRef, { balance: walletData.balance + data.amount });
        
        const assetRef = doc(db, 'assets', id);
        batch.update(assetRef, { outstandingBalance: asset.outstandingBalance - data.amount });

        await batch.commit();
        toast({ title: "Cobro Registrado", description: "El cobro ha sido registrado y los saldos actualizados." });
        fetchPageData();
        setIsAddCollectionOpen(false);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo registrar el cobro.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeleteCollection = async () => {
    if (!deletingCollection || !asset) return;

    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        const collectionRef = doc(db, 'assets', id, 'collections', deletingCollection.id);
        const incomeRef = doc(db, 'properties', deletingCollection.propertyId, 'incomes', deletingCollection.incomeId);
        const walletRef = doc(db, 'wallets', deletingCollection.walletId);
        const assetRef = doc(db, 'assets', id);

        const walletSnap = await getDoc(walletRef);
        if(walletSnap.exists()){
             if (walletSnap.data().balance < deletingCollection.amount) {
                toast({ title: "Error", description: "Fondos insuficientes en la billetera para revertir el cobro.", variant: "destructive" });
                setIsSubmitting(false);
                return;
            }
            batch.update(walletRef, { balance: walletSnap.data().balance - deletingCollection.amount });
        }
        
        batch.update(assetRef, { outstandingBalance: asset.outstandingBalance + deletingCollection.amount });

        batch.delete(collectionRef);
        batch.delete(incomeRef);

        await batch.commit();
        toast({ title: "Cobro eliminado", description: "El cobro y el ingreso asociado han sido eliminados y los saldos revertidos.", variant: "destructive" });
        setDeletingCollection(null);
        fetchPageData();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el cobro.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeleteAsset = async () => {
    if (!asset) return;
    if (collections.length > 0) {
        toast({
            title: "No se puede eliminar",
            description: "Este activo tiene cobros registrados. Elimine primero todos los cobros para poder eliminar el activo.",
            variant: "destructive",
            duration: 6000,
        });
        setIsDeleteAssetOpen(false);
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
        const expensesRef = collectionGroup(db, 'actualExpenses');
        const q = query(expensesRef, where("assetId", "==", asset.id));
        const expenseQuerySnapshot = await getDocs(q);

        if (!expenseQuerySnapshot.empty) {
            const expenseDoc = expenseQuerySnapshot.docs[0];
            const expenseData = expenseDoc.data() as Expense;
            
            const walletRef = doc(db, 'wallets', expenseData.walletId);
            const walletSnap = await getDoc(walletRef);
            
            if (walletSnap.exists()) {
                const currentBalance = walletSnap.data().balance;
                batch.update(walletRef, { balance: currentBalance + expenseData.amount });
            }
            batch.delete(expenseDoc.ref);
        }

        const assetRef = doc(db, 'assets', asset.id);
        batch.delete(assetRef);

        await batch.commit();
        toast({ title: "Activo Eliminado", description: "El activo ha sido eliminado exitosamente.", variant: "destructive" });
        router.push('/assets');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el activo.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleOpenCollectionDialog = () => {
    const matchingSubcategories = incomeCategories
        .flatMap(c => c.subcategories)
        .filter(sc => sc.name.toLowerCase().includes('cobranza de préstamo'));
    
    let defaultSubcategoryId: string | undefined = undefined;
    if (matchingSubcategories.length === 1) {
        defaultSubcategoryId = matchingSubcategories[0].id;
    }

    setCollectionDialogInitialData({
        currency: asset?.currency,
        subcategoryId: defaultSubcategoryId,
        assetId: asset?.id
    });
    setIsAddCollectionOpen(true);
  }


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!asset) {
    notFound();
  }

  const percentagePaid = asset.totalAmount > 0 ? (asset.totalAmount - asset.outstandingBalance) / asset.totalAmount * 100 : 0;
  const currencyClass = cn({
      'text-green-600 dark:text-green-400': asset.currency === 'USD',
      'text-blue-600 dark:text-blue-400': asset.currency === 'ARS',
  });

  return (
    <>
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <PageHeader title={asset.name}>
        <Button asChild variant="outline">
          <Link href={`/assets/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
        <Button variant="destructive-outline" onClick={() => setIsDeleteAssetOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </PageHeader>

      <Card>
          <CardHeader>
              <CardTitle>Resumen del Activo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Monto Total Prestado</p>
                  <p className={cn("text-2xl font-bold", currencyClass)}>{formatCurrency(asset.totalAmount, asset.currency)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Cobrado</p>
                  <p className={cn("text-2xl font-bold", currencyClass)}>{formatCurrency(asset.totalAmount - asset.outstandingBalance, asset.currency)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Saldo por Cobrar</p>
                  <p className="text-2xl font-bold text-teal-500">{formatCurrency(asset.outstandingBalance, asset.currency)}</p>
              </div>
          </CardContent>
          <CardFooter>
            <div className='w-full space-y-2'>
                <Progress value={percentagePaid} />
                <p className="text-sm text-muted-foreground text-center">{percentagePaid.toFixed(1)}% cobrado</p>
            </div>
          </CardFooter>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historial de Cobranzas</CardTitle>
          <Button onClick={handleOpenCollectionDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Registrar Cobro
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cuenta</TableHead>
                <TableHead>Billetera</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.length > 0 ? collections.map(collection => (
                <TableRow key={collection.id}>
                  <TableCell>{format(new Date(collection.date), 'PP', { locale: es })}</TableCell>
                  <TableCell>{properties.find(p => p.id === collection.propertyId)?.name || 'N/A'}</TableCell>
                  <TableCell>{wallets.find(w => w.id === collection.walletId)?.name || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{collection.notes}</TableCell>
                  <TableCell className={cn("text-right font-medium", {
                    'text-green-600 dark:text-green-400': collection.currency === 'USD',
                    'text-blue-600 dark:text-blue-400': collection.currency === 'ARS',
                  })}>
                    {formatCurrency(collection.amount, collection.currency)}
                  </TableCell>
                  <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingCollection(collection)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No se han registrado cobros para este activo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>

    <AddIncomeDialog
        isOpen={isAddCollectionOpen}
        onOpenChange={setIsAddCollectionOpen}
        incomeCategories={incomeCategories}
        wallets={wallets.filter(w => w.currency === asset?.currency)}
        properties={properties}
        onIncomeSubmit={handleCollectionSubmit}
        isSubmitting={isSubmitting}
        initialData={collectionDialogInitialData}
        title="Registrar Cobro de Activo"
        description="Registra un cobro que se asociará a este activo y se registrará como un ingreso en la cuenta que elijas."
    />

    <ConfirmDeleteDialog 
        isOpen={!!deletingCollection}
        onOpenChange={() => setDeletingCollection(null)}
        onConfirm={handleDeleteCollection}
        title="¿Eliminar este cobro?"
        description="Esta acción eliminará el cobro y el ingreso asociado, revirtiendo los saldos de la billetera y del activo. Esta acción es permanente."
    />

    <ConfirmDeleteDialog
        isOpen={isDeleteAssetOpen}
        onOpenChange={setIsDeleteAssetOpen}
        onConfirm={handleDeleteAsset}
        title={`¿Eliminar el activo "${asset?.name}"?`}
        description="Esta acción es permanente y no se puede deshacer. Solo puedes eliminar un activo si no tiene cobros registrados. ¿Continuar?"
    />
    </>
  );
}
