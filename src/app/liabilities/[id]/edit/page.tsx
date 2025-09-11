
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
import { type Liability } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const liabilitySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  totalAmount: z.coerce.number().min(0.01, 'El monto total debe ser positivo.'),
  currency: z.enum(['ARS', 'USD'], { required_error: 'La moneda es obligatoria.' }),
  notes: z.string().optional(),
});

type LiabilityFormValues = z.infer<typeof liabilitySchema>;

export default function EditLiabilityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [originalLiability, setOriginalLiability] = React.useState<Liability | null>(null);

  const form = useForm<LiabilityFormValues>({
    resolver: zodResolver(liabilitySchema),
  });

  React.useEffect(() => {
    const fetchLiability = async () => {
      setLoading(true);
      try {
        const liabilityRef = doc(db, 'liabilities', id);
        const liabilitySnap = await getDoc(liabilityRef);

        if (liabilitySnap.exists()) {
          const data = {id: liabilitySnap.id, ...liabilitySnap.data()} as Liability;
          setOriginalLiability(data);
          form.reset({
            name: data.name,
            totalAmount: data.totalAmount,
            currency: data.currency,
            notes: data.notes,
          });
        } else {
          toast({ title: "Error", description: "Pasivo no encontrado.", variant: "destructive" });
          router.push('/liabilities');
        }
      } catch (error) {
        toast({ title: "Error", description: "No se pudo cargar el pasivo para editar.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchLiability();
  }, [id, form, toast, router]);

  const onSubmit = async (data: LiabilityFormValues) => {
    if (!originalLiability) return;

    setIsSubmitting(true);
    try {
      const liabilityRef = doc(db, 'liabilities', id);
      
      const amountDifference = data.totalAmount - originalLiability.totalAmount;
      const newOutstandingBalance = originalLiability.outstandingBalance + amountDifference;

      await updateDoc(liabilityRef, {
        ...data,
        outstandingBalance: newOutstandingBalance < 0 ? 0 : newOutstandingBalance,
      });

      toast({
        title: 'Pasivo Actualizado',
        description: 'La deuda ha sido actualizada exitosamente.',
      });
      router.push(`/liabilities/${id}`);
    } catch (error) {
      console.error('Error updating liability: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el pasivo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (loading) {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader title="Editar Pasivo" />
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
      <PageHeader title="Editar Pasivo" />
      <Card className="max-w-2xl mx-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Detalles del Pasivo</CardTitle>
              <CardDescription>
                Modifica la información de la deuda.
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
                      <Input placeholder="Ej: Crédito Hipotecario" {...field} />
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
