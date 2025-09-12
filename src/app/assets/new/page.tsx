
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, Timestamp, query, orderBy, getDocs, getDoc } from 'firebase/firestore';
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
import { type Wallet, type Property, type ExpenseCategory } from '@/lib/types';

const assetSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  totalAmount: z.coerce.number().min(0.01, 'El monto prestado debe ser positivo.'),
  currency: z.enum(['ARS', 'USD'], { required_error: 'La moneda es obligatoria.' }),
  walletId: z.string().min(1, 'La billetera de origen es obligatoria.'),
  propertyId: z.string().min(1, 'La cuenta para registrar el gasto es obligatoria.'),
  notes: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;

export default function NewAssetPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [expenseCategories, setExpenseCategories] = React.useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = React.useState(true);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '',
      totalAmount: 0,
      currency: 'ARS',
      walletId: '',
      propertyId: '',
      notes: '',
    },
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletsSnap, propertiesSnap, expenseCatSnap] = await Promise.all([
          getDocs(query(collection(db, 'wallets'), orderBy('name'))),
          getDocs(query(collection(db, 'properties'), orderBy('name'))),
          getDocs(query(collection(db, 'expenseCategories'), orderBy('name'))),
        ]);
        setWallets(walletsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Wallet)));
        setProperties(propertiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
        
        const categoriesList = await Promise.all(expenseCatSnap.docs.map(async (categoryDoc) => {
            const subcategoriesQuery = query(collection(db, 'expenseCategories', categoryDoc.id, 'subcategories'), orderBy('name'));
            const subcategoriesSnapshot = await getDocs(subcategoriesQuery);
            return { id: categoryDoc.id, name: categoryDoc.data().name, subcategories: subcategoriesSnapshot.docs.map(subDoc => ({ id: subDoc.id, name: subDoc.data().name })) };
        }));
        setExpenseCategories(categoriesList);

      } catch (error) {
        toast({ title: "Error", description: "No se pudieron cargar los datos necesarios.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);
  
  const onSubmit = async (data: AssetFormValues) => {
    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
      // 1. Create the new Asset
      const newAssetRef = doc(collection(db, 'assets'));
      const assetData = {
        name: data.name,
        totalAmount: data.totalAmount,
        outstandingBalance: data.totalAmount,
        currency: data.currency,
        creationDate: Timestamp.now(),
        notes: data.notes || '',
      };
      batch.set(newAssetRef, assetData);

      // 2. Subtract amount from the source wallet
      const walletRef = doc(db, 'wallets', data.walletId);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) throw new Error("La billetera seleccionada no existe.");
      const walletData = walletSnap.data();
      if (walletData.balance < data.totalAmount) {
          toast({ title: "Error", description: "Saldo insuficiente en la billetera de origen.", variant: "destructive" });
          setIsSubmitting(false);
          return;
      }
      batch.update(walletRef, { balance: walletData.balance - data.totalAmount });

      // 3. Create a corresponding expense transaction
      const expenseRef = doc(collection(db, 'properties', data.propertyId, 'actualExpenses'));
      const matchingSubcategories = expenseCategories.flatMap(c => c.subcategories).filter(sc => sc.name.toLowerCase().includes('préstamo otorgado'));
      let loanSubcategoryId: string | undefined = undefined;
      if (matchingSubcategories.length > 0) {
        loanSubcategoryId = matchingSubcategories[0].id;
      } else {
        // Fallback or error if category not found
        console.warn("Subcategoría 'Préstamo Otorgado' no encontrada. Se registrará sin subcategoría específica.");
      }

      batch.set(expenseRef, {
        amount: data.totalAmount,
        currency: data.currency,
        date: Timestamp.now(),
        notes: `Préstamo otorgado: ${data.name}`,
        propertyId: data.propertyId,
        subcategoryId: loanSubcategoryId || '',
        walletId: data.walletId,
        assetId: newAssetRef.id,
      });

      await batch.commit();
      toast({
        title: 'Activo Creado',
        description: 'El nuevo préstamo ha sido registrado exitosamente.',
      });
      router.push('/assets');

    } catch (error) {
      console.error('Error creating asset: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el activo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex-1 p-8 flex justify-center items-center"><Loader className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Añadir Nuevo Activo por Cobrar" />

      <Card className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Detalles del Activo</CardTitle>
              <CardDescription>
                Registra un nuevo préstamo otorgado o una cuenta por cobrar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Activo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Préstamo a Juan, Adelanto sueldo" {...field} />
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
                      <FormLabel>Monto Total Prestado</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Ej: 10000" {...field} />
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

               <div className="border p-4 rounded-md space-y-4">
                 <p className="text-sm font-medium">Origen de los Fondos</p>
                  <FormField
                    control={form.control}
                    name="walletId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desde la Billetera</FormLabel>
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
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registrar salida en la Cuenta</FormLabel>
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
                </div>
              
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
                Guardar Activo
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
