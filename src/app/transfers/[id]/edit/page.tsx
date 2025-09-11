
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
            // --- Step 1: Get all required wallet documents ---
            const fromWalletRef = doc(db, 'wallets', data.fromWalletId);
            const toWalletRef = doc(db, 'wallets', data.toWalletId);
            const originalFromWalletRef = doc(db, 'wallets', originalTransfer.fromWalletId);
            const originalToWalletRef = doc(db, 'wallets', originalTransfer.toWalletId);

            const allWalletRefs = new Map();
            allWalletRefs.set(fromWalletRef.path, fromWalletRef);
            allWalletRefs.set(toWalletRef.path, toWalletRef);
            allWalletRefs.set(originalFromWalletRef.path, originalFromWalletRef);
            allWalletRefs.set(originalToWalletRef.path, originalToWalletRef);

            const walletSnapshots = await Promise.all(Array.from(allWalletRefs.values()).map(ref => getDoc(ref)));
            const walletDataMap = new Map(walletSnapshots.map(snap => [snap.ref.path, snap.data() as Wallet]));

            // --- Step 2: Revert the original transaction ---
            const originalFromWalletData = walletDataMap.get(originalFromWalletRef.path);
            const originalToWalletData = walletDataMap.get(originalToWalletRef.path);

            if (!originalFromWalletData || !originalToWalletData) throw new Error("No se encontraron las billeteras originales.");

            const revertedFromBalance = originalFromWalletData.balance + originalTransfer.amountSent;
            const revertedToBalance = originalToWalletData.balance - originalTransfer.amountReceived;
            
            walletDataMap.set(originalFromWalletRef.path, { ...originalFromWalletData, balance: revertedFromBalance });
            walletDataMap.set(originalToWalletRef.path, { ...originalToWalletData, balance: revertedToBalance });

            // --- Step 3: Apply the new transaction ---
            const currentFromWalletData = walletDataMap.get(fromWalletRef.path);
            const currentToWalletData = walletDataMap.get(toWalletRef.path);

            if (!currentFromWalletData || !currentToWalletData) throw new Error("No se encontraron las billeteras actuales.");
            
            if (currentFromWalletData.balance < data.amountSent) {
                toast({ title: "Fondos Insuficientes", description: `El saldo revertido de ${currentFromWalletData.name} no es suficiente para la nueva transacción.`, variant: "destructive" });
                setIsSubmitting(false);
                return;
            }

            const newFromBalance = currentFromWalletData.balance - data.amountSent;
            const newToBalance = currentToWalletData.balance + data.amountReceived;
            
            walletDataMap.set(fromWalletRef.path, { ...currentFromWalletData, balance: newFromBalance });
            walletDataMap.set(toWalletRef.path, { ...currentToWalletData, balance: newToBalance });

            // --- Step 4: Batch update wallets and the transfer itself ---
            walletDataMap.forEach((wallet, path) => {
                batch.update(doc(db, path), { balance: wallet.balance });
            });

            const transferRef = doc(db, 'transfers', id);
            const updatedTransferData = {
                ...data,
                date: originalTransfer.date, // Keep original date or update? Let's keep it for now.
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
            toast({
                title: 'Error',
                description: 'No se pudo actualizar la transferencia.',
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
                                        <Select onValueChange={field.onChange} value={field.value}>
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
