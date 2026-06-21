'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams, notFound } from 'next/navigation';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';


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

  // States for deletion flow
  const [originalName, setOriginalName] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isDoubleConfirmOpen, setIsDoubleConfirmOpen] = React.useState(false);
  const [confirmInput, setConfirmInput] = React.useState('');

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
                setOriginalName(propertyData.name);
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // 1. Delete property subcollections: actualExpenses, incomes, expectedExpenses
      const incomesCol = collection(db, 'properties', id, 'incomes');
      const expensesCol = collection(db, 'properties', id, 'actualExpenses');
      const expectedCol = collection(db, 'properties', id, 'expectedExpenses');

      const [incomesSnap, expensesSnap, expectedSnap] = await Promise.all([
        getDocs(incomesCol),
        getDocs(expensesCol),
        getDocs(expectedCol)
      ]);

      const deleteSubDocs = incomesSnap.docs.map(doc => deleteDoc(doc.ref))
        .concat(expensesSnap.docs.map(doc => deleteDoc(doc.ref)))
        .concat(expectedSnap.docs.map(doc => deleteDoc(doc.ref)));
      
      await Promise.all(deleteSubDocs);

      // 2. Delete liabilities and their payments
      const liabilitiesSnap = await getDocs(collection(db, 'liabilities'));
      const accountLiabilities = liabilitiesSnap.docs.filter(doc => doc.data().propertyId === id);
      
      for (const liabilityDoc of accountLiabilities) {
        const paymentsCol = collection(db, 'liabilities', liabilityDoc.id, 'payments');
        const paymentsSnap = await getDocs(paymentsCol);
        const deletePayments = paymentsSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePayments);
        await deleteDoc(liabilityDoc.ref);
      }

      // 3. Delete assets and their collections
      const assetsSnap = await getDocs(collection(db, 'assets'));
      const accountAssets = assetsSnap.docs.filter(doc => doc.data().propertyId === id);
      
      for (const assetDoc of accountAssets) {
        const collectionsCol = collection(db, 'assets', assetDoc.id, 'collections');
        const collectionsSnap = await getDocs(collectionsCol);
        const deleteCollections = collectionsSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deleteCollections);
        await deleteDoc(assetDoc.ref);
      }

      // 4. Update wallets (remove propertyId from propertyIds)
      const walletsSnap = await getDocs(collection(db, 'wallets'));
      const walletsToUpdate = walletsSnap.docs.filter(doc => {
        const data = doc.data();
        return data.propertyIds && data.propertyIds.includes(id);
      });
      const updateWallets = walletsToUpdate.map(walletDoc => {
        const data = walletDoc.data();
        const updatedIds = (data.propertyIds as string[]).filter(pid => pid !== id);
        return updateDoc(walletDoc.ref, { propertyIds: updatedIds });
      });
      await Promise.all(updateWallets);

      // 5. Update categories and subcategories (remove propertyId from propertyIds)
      const expCatsSnap = await getDocs(collection(db, 'expenseCategories'));
      for (const catDoc of expCatsSnap.docs) {
        const catData = catDoc.data();
        if (catData.propertyIds && catData.propertyIds.includes(id)) {
          const updatedIds = (catData.propertyIds as string[]).filter(pid => pid !== id);
          await updateDoc(catDoc.ref, { propertyIds: updatedIds });
        }
        const subSnap = await getDocs(collection(db, 'expenseCategories', catDoc.id, 'subcategories'));
        for (const subDoc of subSnap.docs) {
          const subData = subDoc.data();
          if (subData.propertyIds && subData.propertyIds.includes(id)) {
            const updatedIds = (subData.propertyIds as string[]).filter(pid => pid !== id);
            await updateDoc(subDoc.ref, { propertyIds: updatedIds });
          }
        }
      }

      const incCatsSnap = await getDocs(collection(db, 'incomeCategories'));
      for (const catDoc of incCatsSnap.docs) {
        const catData = catDoc.data();
        if (catData.propertyIds && catData.propertyIds.includes(id)) {
          const updatedIds = (catData.propertyIds as string[]).filter(pid => pid !== id);
          await updateDoc(catDoc.ref, { propertyIds: updatedIds });
        }
        const subSnap = await getDocs(collection(db, 'incomeCategories', catDoc.id, 'subcategories'));
        for (const subDoc of subSnap.docs) {
          const subData = subDoc.data();
          if (subData.propertyIds && subData.propertyIds.includes(id)) {
            const updatedIds = (subData.propertyIds as string[]).filter(pid => pid !== id);
            await updateDoc(subDoc.ref, { propertyIds: updatedIds });
          }
        }
      }

      // 6. Delete property document
      await deleteDoc(doc(db, 'properties', id));

      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta y todos sus registros asociados fueron eliminados exitosamente.',
      });
      router.push('/properties');
    } catch (error) {
      console.error('Error deleting property and records: ', error);
      toast({
        title: 'Error',
        description: 'Hubo un problema al intentar eliminar la cuenta.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setIsDoubleConfirmOpen(false);
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
                          <FormItem key={image.imageUrl} className="flex items-center space-x-3 space-y-0">
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
              <div className="flex justify-between items-center">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isSubmitting || isDeleting}
                >
                  {isDeleting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Eliminar Cuenta
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => router.push('/properties')} disabled={isDeleting}>
                     Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || isDeleting}>
                    {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Primer Paso de Verificación */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Esta acción eliminará la cuenta <strong>&ldquo;{originalName}&rdquo;</strong> y <strong>todos sus registros asociados</strong> permanentemente.
                </p>
                <p className="font-semibold text-red-500">
                  Se eliminarán permanentemente de esta cuenta:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Todos los ingresos y gastos registrados.</li>
                  <li>Todos los presupuestos/vencimientos planificados.</li>
                  <li>Todas las deudas (pasivos) y préstamos (activos) asociados, incluyendo sus historiales de pago/cobro.</li>
                </ul>
                <p>Esta acción no se puede deshacer.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                setIsConfirmOpen(false);
                setIsDoubleConfirmOpen(true);
              }}
            >
              Entiendo, continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Segundo Paso de Verificación (Doble Verificación) */}
      <AlertDialog open={isDoubleConfirmOpen} onOpenChange={setIsDoubleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmación de Seguridad</AlertDialogTitle>
            <AlertDialogDescription>
              Para confirmar que realmente deseas eliminar la cuenta y todos sus datos, por favor escribe el nombre de la cuenta <strong>&ldquo;{originalName}&rdquo;</strong> a continuación:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Input 
              value={confirmInput} 
              onChange={(e) => setConfirmInput(e.target.value)} 
              placeholder="Escribe el nombre de la cuenta para confirmar" 
              className="w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setConfirmInput('');
              setIsDoubleConfirmOpen(false);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              disabled={confirmInput.trim().toLowerCase() !== originalName.trim().toLowerCase()}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50"
              onClick={handleDelete}
            >
              Eliminar Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
