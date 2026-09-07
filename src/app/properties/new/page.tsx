
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Image from 'next/image';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { AccountImagePicker } from '@/components/properties/AccountImagePicker';


const propertySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  imageUrl: z.string().min(1, 'Debes seleccionar una imagen.'),
  order: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function NewPropertyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: '',
      description: '',
      imageUrl: '',
      notes: '',
    },
  });

  const onSubmit = async (data: PropertyFormValues) => {
    setIsSubmitting(true);
    try {
      const propertiesCollection = collection(db, 'properties');
      const propertiesSnapshot = await getDocs(propertiesCollection);
      const newOrder = (propertiesSnapshot.size || 0) + 1;

      await addDoc(propertiesCollection, {
          ...data,
          order: data.order || newOrder
      });

      toast({
        title: 'Cuenta creada',
        description: 'La nueva cuenta ha sido añadida exitosamente.',
      });
      router.push('/properties');
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la cuenta.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Añadir Nueva Cuenta" />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Detalles de la Cuenta</CardTitle>
          <CardDescription>
            Completa la información a continuación para registrar una nueva cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Cuenta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Apartamento Céntrico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe la cuenta..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Imagen de la Cuenta</FormLabel>
                    <FormControl>
                      <AccountImagePicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden de Visualización (Opcional)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
              <div className="flex justify-end gap-2">
                 <Button type="button" variant="ghost" onClick={() => router.push('/properties')}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cuenta
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
