
'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
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
import { wallets } from "@/lib/data";
import { ArrowRightLeft, Loader } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';

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

type TransferFormValues = z.infer<typeof transferSchema>;

export default function TransfersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  const fromWallet = React.useMemo(() => wallets.find(w => w.id === fromWalletId), [fromWalletId]);
  const toWallet = React.useMemo(() => wallets.find(w => w.id === toWalletId), [toWalletId]);

  const showExchangeRate = fromWallet && toWallet && fromWallet.currency !== toWallet.currency;

  const updateAmounts = () => {
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
  };

  React.useEffect(() => {
    updateAmounts();
  }, [amountSent, exchangeRate, fromWalletId, toWalletId, showExchangeRate, form]);
  
  React.useEffect(() => {
    const sent = form.getValues('amountSent');
    if (fromWallet && toWallet && fromWallet.currency === toWallet.currency) {
      form.setValue('amountReceived', sent);
    }
  }, [fromWalletId, toWalletId, form]);

  const onSubmit = async (data: TransferFormValues) => {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      date: Timestamp.now(),
      fromCurrency: fromWallet?.currency,
      toCurrency: toWallet?.currency,
      exchangeRate: data.exchangeRate || null,
    };


    try {
      await addDoc(collection(db, 'transfers'), dataToSave);
      toast({
        title: 'Transferencia Exitosa',
        description: 'La transferencia de fondos ha sido registrada.',
      });
      form.reset();
      router.push('/');
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

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Transferencia de Fondos" />
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Nueva Transferencia
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
                                {wallet.name} ({wallet.currency})
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
                                {wallet.name} ({wallet.currency})
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
                          <Input type="number" placeholder="0.00" {...field} />
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
                          <Input type="number" placeholder="0.00" {...field} disabled={showExchangeRate} />
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
                           <Input type="number" placeholder="Ej: 1000" {...field} value={field.value ?? ''} />
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
