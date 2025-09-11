
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, addDoc, doc, getDocs, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Loader } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { type Wallet } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const transferSchema = z.object({
  fromWalletId: z.string().min(1, 'La billetera de origen es obligatoria.'),
  toWalletId: z.string().min(1, 'La billetera de destino es obligatoria.'),
  amountSent: z.coerce.number().min(0.01, 'El monto enviado debe ser positivo.'),
  amountReceived: z.coerce.number().min(0.01, 'El monto recibido debe ser positivo.'),
  exchangeRate: z.coerce.number().optional(),
  notes: z.string().optional(),
}).refine(data => data.fromWalletId !== data.toWalletId, {
  message: 'La billetera de origen y destino no pueden ser la misma.',
  path: ['toWalletId'],
});

export type TransferFormValues = z.infer<typeof transferSchema>;

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export default function NewTransferPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [loadingWallets, setLoadingWallets] = React.useState(true);

  React.useEffect(() => {
    const fetchWallets = async () => {
      setLoadingWallets(true);
      try {
        const walletsCol = collection(db, 'wallets');
        const walletsSnapshot = await getDocs(walletsCol);
        const walletsList = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
        setWallets(walletsList);
      } catch (error) {
        console.error("Error fetching wallets:", error);
        toast({ title: "Error", description: "No se pudieron cargar las billeteras.", variant: "destructive" });
      } finally {
        setLoadingWallets(false);
      }
    };
    fetchWallets();
  }, [toast]);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWalletId: '',
      toWalletId: '',
      amountSent: 0,
      amountReceived: 0,
      exchangeRate: undefined,
      notes: '',
    },
  });

  const fromWalletId = form.watch('fromWalletId');
  const toWalletId = form.watch('toWalletId');
  const amountSent = form.watch('amountSent');
  const exchangeRate = form.watch('exchangeRate');

  const fromWallet = React.useMemo(() => wallets.find(w => w.id === fromWalletId), [wallets, fromWalletId]);
  const toWallet = React.useMemo(() => wallets.find(w => w.id === toWalletId), [wallets, toWalletId]);

  const showExchangeRate = fromWallet && toWallet && fromWallet.currency !== toWallet.currency;

  const updateAmounts = React.useCallback(() => {
    const sent = form.getValues('amountSent');
    const rate = form.getValues('exchangeRate');

    if (showExchangeRate && sent > 0 && rate && rate > 0) {
      if (fromWallet?.currency === 'USD' && toWallet?.currency === 'ARS') {
        form.setValue('amountReceived', parseFloat((sent * rate).toFixed(2)));
      } else if (fromWallet?.currency === 'ARS' && toWallet?.currency === 'USD') {
        form.setValue('amountReceived', parseFloat((sent / rate).toFixed(2)));
      }
    } else if (fromWallet && toWallet && fromWallet.currency === toWallet.currency) {
      form.setValue('amountReceived', sent);
    }
  }, [form, fromWallet, toWallet, showExchangeRate]);

  React.useEffect(() => {
    updateAmounts();
  }, [amountSent, exchangeRate, fromWalletId, toWalletId, showExchangeRate, updateAmounts]);
  
  React.useEffect(() => {
    const sent = form.getValues('amountSent');
    if (fromWallet && toWallet && fromWallet.currency === toWallet.currency) {
      form.setValue('amountReceived', sent);
    } else {
        updateAmounts();
    }
  }, [fromWalletId, toWalletId, form, fromWallet, toWallet, updateAmounts]);

  const onSubmit = async (data: TransferFormValues) => {
    if (!fromWallet || !toWallet) {
        toast({ title: "Error", description: "Billeteras no válidas.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    
    const batch = writeBatch(db);

    try {
        const fromWalletRef = doc(db, 'wallets', data.fromWalletId);
        const toWalletRef = doc(db, 'wallets', data.toWalletId);
        
        const [fromWalletSnap, toWalletSnap] = await Promise.all([
            getDoc(fromWalletRef),
            getDoc(toWalletRef)
        ]);

        if (!fromWalletSnap.exists() || !toWalletSnap.exists()) {
            throw new Error("Una de las billeteras no existe.");
        }

        const fromWalletData = fromWalletSnap.data() as Wallet;
        
        if (fromWalletData.balance < data.amountSent) {
            toast({ title: "Fondos Insuficientes", description: `La billetera ${fromWalletData.name} no tiene suficiente saldo.`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }

        const newFromBalance = fromWalletData.balance - data.amountSent;
        const newToBalance = (toWalletSnap.data() as Wallet).balance + data.amountReceived;
        
        batch.update(fromWalletRef, { balance: newFromBalance });
        batch.update(toWalletRef, { balance: newToBalance });

        const transferRef = doc(collection(db, 'transfers'));
        const transferData = {
          ...data,
          date: Timestamp.now(),
          fromCurrency: fromWallet.currency,
          toCurrency: toWallet.currency,
          exchangeRate: showExchangeRate ? data.exchangeRate : null,
        };
        batch.set(transferRef, transferData);
        
        await batch.commit();

        toast({
            title: 'Transferencia Exitosa',
            description: 'La transferencia de fondos ha sido registrada y los saldos actualizados.',
        });
        form.reset();
        router.push('/transfers');
        
    } catch (error) {
        console.error('Error creating transfer: ', error);
        toast({
            title: 'Error',
            description: 'No se pudo registrar la transferencia.',
            variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (loadingWallets) {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader title="Nueva Transferencia" />
            <div className="flex justify-center">
                <Card className="w-full max-w-2xl">
                    <CardHeader><CardTitle>Cargando Billeteras...</CardTitle></CardHeader>
                    <CardContent className='space-y-4'>
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Nueva Transferencia" />
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Transferencia de Fondos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fromWalletId"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Desde la billetera</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una billetera" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {wallets.map(wallet => (
                              <SelectItem key={wallet.id} value={wallet.id}>
                                <div className="flex justify-between w-full">
                                  <span>{wallet.name} ({wallet.currency})</span>
                                  <span className="text-muted-foreground ml-4">{formatCurrency(wallet.balance, wallet.currency)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toWalletId"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Hacia la billetera</Label>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una billetera" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {wallets.map(wallet => (
                              <SelectItem key={wallet.id} value={wallet.id} disabled={wallet.id === fromWalletId}>
                                <div className="flex justify-between w-full">
                                  <span>{wallet.name} ({wallet.currency})</span>
                                  <span className="text-muted-foreground ml-4">{formatCurrency(wallet.balance, wallet.currency)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amountSent"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Monto Enviado {fromWallet && `(${fromWallet.currency})`}</Label>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amountReceived"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Monto Recibido {toWallet && `(${toWallet.currency})`}</Label>
                        <FormControl>
                           <Input type="number" step="0.01" placeholder="0.00" {...field} disabled={fromWallet?.currency === toWallet?.currency} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {showExchangeRate && (
                  <FormField
                    control={form.control}
                    name="exchangeRate"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Tasa de Cambio (1 USD a ARS)</Label>
                        <FormControl>
                           <Input type="number" step="any" placeholder="Ej: 1000" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <Label>Notas (Opcional)</Label>
                            <FormControl>
                                <Textarea placeholder="Notas opcionales sobre la transferencia" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              </CardContent>
              <CardFooter className='flex-col gap-4 items-stretch'>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                   {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                   Completar Transferencia
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                    Cancelar
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
