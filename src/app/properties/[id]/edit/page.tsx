
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams, notFound } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { type Property } from '@/lib/types';


const propertySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  imageUrl: z.string().min(1, 'Debes seleccionar una imagen.'),
  order: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
  });
  
  React.useEffect(() => {
    if (!id) return;
    const fetchProperty = async () => {
        setLoading(true);
        try {
            const propertyRef = doc(db, 'properties', id);
            const propertySnap = await getDoc(propertyRef);

            if (propertySnap.exists()) {
                const propertyData = propertySnap.data() as Property;
                form.reset({
                  ...propertyData,
                  order: propertyData.order ?? undefined
                });
            } else {
                notFound();
            }
        } catch (error) {
            console.error("Error fetching property:", error);
            toast({ title: "Error", description: "No se pudo cargar la cuenta.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    fetchProperty();
  }, [id, form, toast]);


  const onSubmit = async (data: PropertyFormValues) => {
    setIsSubmitting(true);
    try {
      const propertyRef = doc(db, 'properties', id);
      await updateDoc(propertyRef, data);
      toast({
        title: 'Cuenta actualizada',
        description: 'La cuenta ha sido actualizada exitosamente.',
      });
      router.push('/properties');
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la cuenta.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (loading) {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Editar Cuenta" />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Detalles de la Cuenta</CardTitle>
          <CardDescription>
            Modifica la información de la cuenta.
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
                    <FormLabel>Selecciona una Imagen</FormLabel>
                     <FormMessage />
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-3 md:grid-cols-4 gap-4"
                      >
                        {PlaceHolderImages.map((image) => (
                          <FormItem key={image.id} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={image.imageUrl} className="sr-only" />
                            </FormControl>
                            <FormLabel className="font-normal">
                               <Image
                                src={image.imageUrl}
                                alt={image.description}
                                width={150}
                                height={150}
                                className={cn(
                                  "h-full w-full object-cover rounded-md cursor-pointer transition-all hover:scale-105",
                                  field.value === image.imageUrl ? 'ring-2 ring-primary ring-offset-2' : 'ring-1 ring-border'
                                )}
                                data-ai-hint={image.imageHint}
                              />
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden de Visualización</FormLabel>
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
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
