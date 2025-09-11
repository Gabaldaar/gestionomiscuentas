
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, doc, getDocs, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Loader } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { type Wallet, type Transfer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { type TransferFormValues } from '../new/page';

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

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export default function EditTransferPage() {
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [wallets, setWallets] = React.useState<Wallet[]>([]);
    const [originalTransfer, setOriginalTransfer] = React.useState<Transfer | null>(null);

    const form = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: {
            exchangeRate: undefined,
        }
    });

    React.useEffect(() => {
        const fetchWalletsAndTransfer = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // Fetch wallets
                const walletsCol = collection(db, 'wallets');
                const walletsSnapshot = await getDocs(walletsCol);
                const walletsList = walletsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wallet));
                setWallets(walletsList);

                // Fetch transfer
                const transferRef = doc(db, 'transfers', id);
                const transferSnap = await getDoc(transferRef);
                if (transferSnap.exists()) {
                    const transferData = { id: transferSnap.id, ...transferSnap.data() } as Transfer;
                    setOriginalTransfer(transferData);
                    form.reset({
                        fromWalletId: transferData.fromWalletId,
                        toWalletId: transferData.toWalletId,
                        amountSent: transferData.amountSent,
                        amountReceived: transferData.amountReceived,
                        exchangeRate: transferData.exchangeRate ?? undefined,
                        notes: transferData.notes ?? '',
                    });
                } else {
                    toast({ title: "Error", description: "Transferencia no encontrada.", variant: "destructive" });
                    router.push('/transfers');
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                toast({ title: "Error", description: "No se pudieron cargar los datos para editar.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };
        fetchWalletsAndTransfer();
    }, [id, toast, router, form]);

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

    const onSubmit = async (data: TransferFormValues) => {
        if (!originalTransfer || !fromWallet || !toWallet) {
            toast({ title: "Error", description: "Datos incompletos para procesar la edición.", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const batch = writeBatch(db);

        try {
            // --- Step 1: Get all required wallet documents from Firestore ---
            const walletRefs = new Map<string, ReturnType<typeof doc>>();
            walletRefs.set(data.fromWalletId, doc(db, 'wallets', data.fromWalletId));
            walletRefs.set(data.toWalletId, doc(db, 'wallets', data.toWalletId));
            walletRefs.set(originalTransfer.fromWalletId, doc(db, 'wallets', originalTransfer.fromWalletId));
            walletRefs.set(originalTransfer.toWalletId, doc(db, 'wallets', originalTransfer.toWalletId));

            const walletSnapshots = await Promise.all(Array.from(walletRefs.values()).map(ref => getDoc(ref)));
            
            const walletDataMap = new Map<string, Wallet>();
            for(const snap of walletSnapshots) {
                if (snap.exists()) {
                    walletDataMap.set(snap.id, snap.data() as Wallet);
                }
            }
            
            // --- Step 2: Revert the original transaction ---
            const originalFromWalletData = walletDataMap.get(originalTransfer.fromWalletId);
            const originalToWalletData = walletDataMap.get(originalTransfer.toWalletId);

            if (!originalFromWalletData || !originalToWalletData) {
                throw new Error("No se encontraron las billeteras originales. No se puede revertir la transacción.");
            }

            const balances = new Map<string, number>();
            balances.set(originalTransfer.fromWalletId, originalFromWalletData.balance + originalTransfer.amountSent);
            balances.set(originalTransfer.toWalletId, (balances.get(originalTransfer.toWalletId) ?? originalToWalletData.balance) - originalTransfer.amountReceived);

            // --- Step 3: Apply the new transaction ---
            const currentFromWalletBalance = balances.get(data.fromWalletId);
            const currentToWalletBalance = balances.get(data.toWalletId);
            const currentToWalletData = walletDataMap.get(data.toWalletId);
            const currentFromWalletData = walletDataMap.get(data.fromWalletId);


            if (currentFromWalletBalance === undefined || currentToWalletBalance === undefined || !currentToWalletData || !currentFromWalletData) {
                 throw new Error("No se encontraron las billeteras para la nueva transacción.");
            }
            
            if (currentFromWalletBalance < data.amountSent) {
                toast({ title: "Fondos Insuficientes", description: `El saldo revertido de ${currentFromWalletData.name} no es suficiente para la nueva transacción.`, variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            balances.set(data.fromWalletId, currentFromWalletBalance - data.amountSent);
            balances.set(data.toWalletId, currentToWalletBalance + data.amountReceived);

            // --- Step 4: Batch update wallets and the transfer itself ---
            balances.forEach((balance, walletId) => {
                const walletRef = doc(db, 'wallets', walletId);
                batch.update(walletRef, { balance });
            });

            const transferRef = doc(db, 'transfers', id);
            const updatedTransferData = {
                ...data,
                date: originalTransfer.date, // Keep original date
                fromCurrency: fromWallet.currency,
                toCurrency: toWallet.currency,
                exchangeRate: showExchangeRate ? data.exchangeRate : null,
            };
            batch.update(transferRef, updatedTransferData);

            await batch.commit();

            toast({
                title: 'Transferencia Actualizada',
                description: 'La transferencia y los saldos de las billeteras han sido actualizados.',
            });
            router.push('/transfers');

        } catch (error) {
            console.error('Error updating transfer: ', error);
            const errorMessage = error instanceof Error ? error.message : 'No se pudo actualizar la transferencia.';
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loading) {
        return (
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <PageHeader title="Editar Transferencia" />
                <div className="flex justify-center">
                    <Card className="w-full max-w-2xl">
                        <CardHeader><CardTitle>Cargando Datos...</CardTitle></CardHeader>
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
            <PageHeader title="Editar Transferencia" />
            <div className="flex justify-center">
                <Card className="w-full max-w-2xl">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ArrowRightLeft className="h-5 w-5" />
                                    Modificar Transferencia
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
                                                <Textarea placeholder="Notas opcionales sobre la transferencia" {...field} value={field.value ?? ''}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className='flex-col gap-4 items-stretch'>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
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

    
