
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { type Asset } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const assetSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  totalAmount: z.coerce.number().min(0.01, 'El monto total debe ser positivo.'),
  currency: z.enum(['ARS', 'USD'], { required_error: 'La moneda es obligatoria.' }),
  notes: z.string().optional(),
});

type AssetFormValues = z.infer<typeof assetSchema>;

export default function EditAssetPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [originalAsset, setOriginalAsset] = React.useState<Asset | null>(null);

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '',
      notes: '',
      currency: 'ARS',
      totalAmount: 0,
    }
  });

  React.useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true);
      try {
        const assetRef = doc(db, 'assets', id);
        const assetSnap = await getDoc(assetRef);

        if (assetSnap.exists()) {
          const data = {id: assetSnap.id, ...assetSnap.data()} as Asset;
          setOriginalAsset(data);
          form.reset({
            name: data.name,
            totalAmount: data.totalAmount,
            currency: data.currency,
            notes: data.notes || '',
          });
        } else {
          toast({ title: "Error", description: "Activo no encontrado.", variant: "destructive" });
          router.push('/assets');
        }
      } catch (error) {
        toast({ title: "Error", description: "No se pudo cargar el activo para editar.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (id) {
        fetchAsset();
    }
  }, [id, form, toast, router]);

  const onSubmit = async (data: AssetFormValues) => {
    if (!originalAsset) return;

    setIsSubmitting(true);
    try {
      const assetRef = doc(db, 'assets', id);
      
      const amountDifference = data.totalAmount - originalAsset.totalAmount;
      const newOutstandingBalance = originalAsset.outstandingBalance + amountDifference;

      await updateDoc(assetRef, {
        ...data,
        outstandingBalance: newOutstandingBalance < 0 ? 0 : newOutstandingBalance,
      });

      toast({
        title: 'Activo Actualizado',
        description: 'La cuenta por cobrar ha sido actualizada exitosamente.',
      });
      router.push(`/assets/${id}`);
    } catch (error) {
      console.error('Error updating asset: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el activo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading) {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader title="Editar Activo" />
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle><Skeleton className="h-8 w-3/4" /></CardTitle>
                    <CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Editar Activo" />
      <Card className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Detalles del Activo</CardTitle>
              <CardDescription>
                Modifica la información de la cuenta por cobrar.
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
                      <Input placeholder="Ej: Préstamo a Juan" {...field} />
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
                      <FormLabel>Monto Total</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value} disabled>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className='flex-col gap-4 items-stretch'>
              <Button type="submit" disabled={isSubmitting}>
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
  );
}
