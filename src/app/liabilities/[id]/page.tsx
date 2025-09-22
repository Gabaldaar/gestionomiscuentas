
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
import { Pencil, Loader, PlusCircle, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Liability, type LiabilityPayment, type Wallet, type ExpenseCategory, type Property, type Income } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AddExpenseDialog, type ExpenseFormValues } from '@/components/properties/AddExpenseDialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';


const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export default function LiabilityDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const router = useRouter();

  const [liability, setLiability] = React.useState<Liability | null>(null);
  const [payments, setPayments] = React.useState<LiabilityPayment[]>([]);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [expenseCategories, setExpenseCategories] = React.useState<ExpenseCategory[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = React.useState(false);

  const [deletingPayment, setDeletingPayment] = React.useState<LiabilityPayment | null>(null);
  const [isDeleteLiabilityOpen, setIsDeleteLiabilityOpen] = React.useState(false);
  const [paymentDialogInitialData, setPaymentDialogInitialData] = React.useState<Partial<ExpenseFormValues> | null>(null);

  const fetchPageData = React.useCallback(async () => {
    setLoading(true);
    try {
      const liabilityRef = doc(db, "liabilities", id);
      const liabilitySnap = await getDoc(liabilityRef);

      if (!liabilitySnap.exists()) {
        notFound();
        return;
      }
      const liabilityData = { id: liabilitySnap.id, ...liabilitySnap.data() } as Liability;
      setLiability(liabilityData);

      const [paymentsSnap, walletsSnap, propertiesSnap, expenseCatSnap] = await Promise.all([
        getDocs(query(collection(db, "liabilities", id, "payments"), orderBy("date", "desc"))),
        getDocs(query(collection(db, "wallets"))),
        getDocs(query(collection(db, "properties"))),
        getDocs(query(collection(db, 'expenseCategories'), orderBy('name'))),
      ]);
      
      setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data(), date: (d.data().date as Timestamp).toDate().toISOString() } as LiabilityPayment)));
      setWallets(walletsSnap.docs.map(d => ({ id: d.id, ...d.data()} as Wallet)));
      setProperties(propertiesSnap.docs.map(d => ({ id: d.id, ...d.data()} as Property)));
      
      const expenseCategoriesList = await Promise.all(expenseCatSnap.docs.map(async (categoryDoc) => {
        const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
        const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
        return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
      }));
      setExpenseCategories(expenseCategoriesList);

    } catch (error) {
      console.error("Error fetching liability data:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos del pasivo.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);


  const handlePaymentSubmit = async (data: ExpenseFormValues) => {
    if (!liability) return;

    const propertyId = (data as any).propertyId;
    if (!propertyId) {
        toast({ title: "Error", description: "Debes seleccionar una cuenta para registrar el gasto del pago.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
        const expenseRef = doc(collection(db, 'properties', propertyId, 'actualExpenses'));
        const expenseData = { ...data, date: Timestamp.fromDate(data.date), propertyId, liabilityId: liability.id };
        batch.set(expenseRef, expenseData);

        const paymentRef = doc(collection(db, 'liabilities', id, 'payments'));
        const paymentData = {
            liabilityId: id,
            date: Timestamp.fromDate(data.date),
            amount: data.amount,
            walletId: data.walletId,
            currency: data.currency,
            notes: data.notes,
            actualExpenseId: expenseRef.id,
            propertyId: propertyId,
        };
        batch.set(paymentRef, paymentData);

        const walletRef = doc(db, 'wallets', data.walletId);
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("Billetera no encontrada");
        const walletData = walletSnap.data() as Wallet;
        if (walletData.balance < data.amount && !walletData.allowNegativeBalance) {
          throw new Error("Fondos insuficientes en la billetera.");
        }
        batch.update(walletRef, { balance: walletData.balance - data.amount });
        
        const liabilityRef = doc(db, 'liabilities', id);
        batch.update(liabilityRef, { outstandingBalance: liability.outstandingBalance - data.amount });

        await batch.commit();
        toast({ title: "Pago Registrado", description: "El pago ha sido registrado y los saldos actualizados." });
        fetchPageData();
        setIsAddPaymentOpen(false);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo registrar el pago.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeletePayment = async () => {
    if (!deletingPayment || !liability) return;

    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        const paymentRef = doc(db, 'liabilities', id, 'payments', deletingPayment.id);
        const expenseRef = doc(db, 'properties', deletingPayment.propertyId, 'actualExpenses', deletingPayment.actualExpenseId);
        const walletRef = doc(db, 'wallets', deletingPayment.walletId);
        const liabilityRef = doc(db, 'liabilities', id);

        const walletSnap = await getDoc(walletRef);
        if(walletSnap.exists()){
            batch.update(walletRef, { balance: walletSnap.data().balance + deletingPayment.amount });
        }
        
        batch.update(liabilityRef, { outstandingBalance: liability.outstandingBalance + deletingPayment.amount });

        batch.delete(paymentRef);
        batch.delete(expenseRef);

        await batch.commit();
        toast({ title: "Pago eliminado", description: "El pago y el gasto asociado han sido eliminados y los saldos revertidos.", variant: "destructive" });
        setDeletingPayment(null);
        fetchPageData();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el pago.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeleteLiability = async () => {
    if (!liability) return;
    if (payments.length > 0) {
        toast({
            title: "No se puede eliminar",
            description: "Este pasivo tiene pagos registrados. Elimine primero todos los pagos para poder eliminar el pasivo.",
            variant: "destructive",
            duration: 6000,
        });
        setIsDeleteLiabilityOpen(false);
        return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
        const incomesRef = collectionGroup(db, 'incomes');
        const q = query(incomesRef, where("liabilityId", "==", liability.id));
        const incomeQuerySnapshot = await getDocs(q);

        if (!incomeQuerySnapshot.empty) {
            const incomeDoc = incomeQuerySnapshot.docs[0];
            const incomeData = incomeDoc.data() as Income;
            
            const walletRef = doc(db, 'wallets', incomeData.walletId);
            const walletSnap = await getDoc(walletRef);
            
            if (walletSnap.exists()) {
                const currentBalance = walletSnap.data().balance;
                batch.update(walletRef, { balance: currentBalance - incomeData.amount });
            }
            batch.delete(incomeDoc.ref);
        }

        const liabilityRef = doc(db, 'liabilities', liability.id);
        batch.delete(liabilityRef);

        await batch.commit();
        toast({ title: "Pasivo Eliminado", description: "El pasivo ha sido eliminado exitosamente.", variant: "destructive" });
        router.push('/liabilities');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el pasivo.";
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleOpenPaymentDialog = () => {
    const matchingSubcategories = expenseCategories
        .flatMap(c => c.subcategories)
        .filter(sc => sc.name.toLowerCase().includes('pago de crédito'));
    
    let defaultSubcategoryId: string | undefined = undefined;
    if (matchingSubcategories.length === 1) {
        defaultSubcategoryId = matchingSubcategories[0].id;
    }

    setPaymentDialogInitialData({
        currency: liability?.currency,
        subcategoryId: defaultSubcategoryId,
        liabilityId: liability?.id
    });
    setIsAddPaymentOpen(true);
  }


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!liability) {
    notFound();
  }

  const percentagePaid = liability.totalAmount > 0 ? (liability.totalAmount - liability.outstandingBalance) / liability.totalAmount * 100 : 0;
  const currencyClass = cn({
      'text-green-600 dark:text-green-400': liability.currency === 'USD',
      'text-blue-600 dark:text-blue-400': liability.currency === 'ARS',
  });

  return (
    <>
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <PageHeader title={liability.name}>
        <Button asChild variant="outline">
          <Link href={`/liabilities/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
        <Button variant="destructive-outline" onClick={() => setIsDeleteLiabilityOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </PageHeader>

      <Card>
          <CardHeader>
              <CardTitle>Resumen del Pasivo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Monto Total</p>
                  <p className={cn("text-2xl font-bold", currencyClass)}>{formatCurrency(liability.totalAmount, liability.currency)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Pagado</p>
                  <p className={cn("text-2xl font-bold", currencyClass)}>{formatCurrency(liability.totalAmount - liability.outstandingBalance, liability.currency)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Saldo Pendiente</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(liability.outstandingBalance, liability.currency)}</p>
              </div>
          </CardContent>
          <CardFooter>
            <div className='w-full space-y-2'>
                <Progress value={percentagePaid} />
                <p className="text-sm text-muted-foreground text-center">{percentagePaid.toFixed(1)}% pagado</p>
            </div>
          </CardFooter>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historial de Pagos</CardTitle>
          <Button onClick={handleOpenPaymentDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Registrar Pago
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
              {payments.length > 0 ? payments.map(payment => (
                <TableRow key={payment.id}>
                  <TableCell>{format(new Date(payment.date), 'PP', { locale: es })}</TableCell>
                  <TableCell>{properties.find(p => p.id === payment.propertyId)?.name || 'N/A'}</TableCell>
                  <TableCell>{wallets.find(w => w.id === payment.walletId)?.name || 'N/A'}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">{payment.notes}</TableCell>
                  <TableCell className={cn("text-right font-medium", {
                    'text-green-600 dark:text-green-400': payment.currency === 'USD',
                    'text-blue-600 dark:text-blue-400': payment.currency === 'ARS',
                  })}>
                    {formatCurrency(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingPayment(payment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No se han registrado pagos para este pasivo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>

    <AddExpenseDialog
        isOpen={isAddPaymentOpen}
        onOpenChange={setIsAddPaymentOpen}
        expenseCategories={expenseCategories}
        wallets={wallets.filter(w => w.currency === liability?.currency)}
        properties={properties}
        liabilities={liability ? [liability] : []}
        onExpenseSubmit={handlePaymentSubmit}
        isSubmitting={isSubmitting}
        initialData={paymentDialogInitialData}
        title="Registrar Pago de Pasivo"
        description="Registra un pago que se asociará a este pasivo y se registrará como un gasto en la cuenta que elijas."
    />

    <ConfirmDeleteDialog 
        isOpen={!!deletingPayment}
        onOpenChange={() => setDeletingPayment(null)}
        onConfirm={handleDeletePayment}
        title="¿Eliminar este pago?"
        description="Esta acción eliminará el pago y el gasto asociado, revirtiendo los saldos de la billetera y del pasivo. Esta acción es permanente."
    />

    <ConfirmDeleteDialog
        isOpen={isDeleteLiabilityOpen}
        onOpenChange={setIsDeleteLiabilityOpen}
        onConfirm={handleDeleteLiability}
        title={`¿Eliminar el pasivo "${liability?.name}"?`}
        description="Esta acción es permanente y no se puede deshacer. Solo puedes eliminar un pasivo si no tiene pagos registrados. ¿Continuar?"
    />
    </>
  );
}
