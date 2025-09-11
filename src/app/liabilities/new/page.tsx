
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, doc, writeBatch, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { type Wallet, type Property, type IncomeCategory } from '@/lib/types';

const liabilitySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  totalAmount: z.coerce.number().min(0.01, 'El monto total debe ser positivo.'),
  currency: z.enum(['ARS', 'USD'], { required_error: 'La moneda es obligatoria.' }),
  initialAmountReceived: z.coerce.number().min(0).optional(),
  walletId: z.string().optional(),
  propertyId: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => {
  if (data.initialAmountReceived && data.initialAmountReceived > 0) {
    return !!data.walletId && !!data.propertyId;
  }
  return true;
}, {
  message: 'Debes seleccionar una billetera y una cuenta si recibes un monto inicial.',
  path: ['walletId'],
});

type LiabilityFormValues = z.infer<typeof liabilitySchema>;

export default function NewLiabilityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [incomeCategories, setIncomeCategories] = React.useState<IncomeCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  const form = useForm<LiabilityFormValues>({
    resolver: zodResolver(liabilitySchema),
    defaultValues: {
      name: '',
      totalAmount: 0,
      currency: 'ARS',
      initialAmountReceived: 0,
      walletId: '',
      propertyId: '',
      notes: '',
    },
  });

  const initialAmountReceived = form.watch('initialAmountReceived');

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsSnap, propertiesSnap, incomeCatSnap] = await Promise.all([
          getDocs(query(collection(db, 'wallets'), orderBy('name'))),
          getDocs(query(collection(db, 'properties'), orderBy('name'))),
          getDocs(query(collection(db, 'incomeCategories'), orderBy('name'))),
        ]);
        setWallets(walletsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
        setProperties(propertiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
        setIncomeCategories(incomeCatSnap.docs.map(d => ({ id: d.id, ...d.data() } as IncomeCategory)));
      } catch (error) {
        toast({ title: "Error", description: "No se pudieron cargar los datos necesarios.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);
  

  const onSubmit = async (data: LiabilityFormValues) => {
    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
      const newLiabilityRef = doc(collection(db, 'liabilities'));
      
      const liabilityData = {
        name: data.name,
        totalAmount: data.totalAmount,
        outstandingBalance: data.totalAmount,
        currency: data.currency,
        creationDate: Timestamp.now(),
        notes: data.notes || '',
      };
      batch.set(newLiabilityRef, liabilityData);

      // If an initial amount was received, create an income transaction
      if (data.initialAmountReceived && data.initialAmountReceived > 0 && data.walletId && data.propertyId) {
        const walletRef = doc(db, 'wallets', data.walletId);
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) throw new Error("La billetera seleccionada no existe.");

        const walletData = walletSnap.data();
        batch.update(walletRef, { balance: walletData.balance + data.initialAmountReceived });

        const incomeRef = doc(collection(db, 'properties', data.propertyId, 'incomes'));
        
        const creditSubcategory = incomeCategories.flatMap(c => c.subcategories).find(sc => sc.name.toLowerCase().includes('crédito'));

        batch.set(incomeRef, {
          amount: data.initialAmountReceived,
          currency: data.currency,
          date: Timestamp.now(),
          notes: `Monto inicial recibido del pasivo: ${data.name}`,
          propertyId: data.propertyId,
          subcategoryId: creditSubcategory?.id || '', // Fallback to empty string
          walletId: data.walletId,
          liabilityId: newLiabilityRef.id,
        });
      }

      await batch.commit();
      toast({
        title: 'Pasivo Creado',
        description: 'La nueva deuda ha sido registrada exitosamente.',
      });
      router.push('/liabilities');

    } catch (error) {
      console.error('Error creating liability: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el pasivo.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 p-8 flex justify-center items-center"><Loader className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Añadir Nuevo Pasivo" />

      <Card className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Detalles del Pasivo</CardTitle>
              <CardDescription>
                Registra un nuevo préstamo, crédito u otra deuda.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Pasivo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Crédito Hipotecario, Préstamo Coche" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="totalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Total de la Deuda</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Ej: 50000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ARS">ARS</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                  control={form.control}
                  name="initialAmountReceived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto Inicial Recibido (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Monto que ingresó a tu billetera" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              {initialAmountReceived && initialAmountReceived > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md">
                   <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Acreditar en Cuenta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {properties.map(prop => <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="walletId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>En la Billetera</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecciona una billetera" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {wallets.filter(w => w.currency === form.getValues('currency')).map(wallet => (
                              <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Añade notas adicionales aquí..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
            <CardFooter className='flex-col gap-4 items-stretch'>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Pasivo
              </Button>
               <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>
                  Cancelar
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
