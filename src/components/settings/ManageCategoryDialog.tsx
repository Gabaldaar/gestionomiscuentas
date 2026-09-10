
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { type ExpenseCategory, type IncomeCategory, type Property } from '@/lib/types';
import Image from 'next/image';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type ManageCategoryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  categoryToEdit?: Pick<ExpenseCategory | IncomeCategory, 'id' | 'name' | 'propertyId' | 'propertyIds'> | null;
  collectionPath: string;
  entityName: string;
  properties: Property[];
  defaultPropertyId?: string;
};

export function ManageCategoryDialog({
  isOpen,
  onOpenChange,
  onSave,
  categoryToEdit,
  collectionPath,
  entityName,
  properties,
  defaultPropertyId,
}: ManageCategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!categoryToEdit;

  // Determine propertyId
  const assignedPropertyId = React.useMemo(() => {
    if (categoryToEdit?.propertyId) return categoryToEdit.propertyId;
    if (categoryToEdit?.propertyIds && categoryToEdit.propertyIds.length > 0) return categoryToEdit.propertyIds[0];
    if (defaultPropertyId && defaultPropertyId !== 'all') return defaultPropertyId;
    return properties[0]?.id || '';
  }, [categoryToEdit, defaultPropertyId, properties]);

  const assignedProperty = React.useMemo(() => {
    return properties.find(p => p.id === assignedPropertyId);
  }, [properties, assignedPropertyId]);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        name: categoryToEdit?.name || '',
      });
    }
  }, [isOpen, categoryToEdit, form]);

  const onSubmit = async (data: CategoryFormValues) => {
    if (!assignedPropertyId) {
      toast({
        title: 'Error',
        description: 'No se ha podido determinar la cuenta para esta categoría.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        propertyId: assignedPropertyId,
        propertyIds: [assignedPropertyId],
      };

      if (isEditing && categoryToEdit) {
        const categoryRef = doc(db, collectionPath, categoryToEdit.id);
        await updateDoc(categoryRef, payload);
        toast({ title: `${entityName} actualizada` });
      } else {
        await addDoc(collection(db, collectionPath), payload);
        toast({ title: `${entityName} creada` });
      }
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error saving ${entityName}:`, error);
      toast({
        title: 'Error',
        description: `No se pudo guardar la ${entityName.toLowerCase()}.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{isEditing ? `Editar ${entityName}` : `Añadir ${entityName}`}</DialogTitle>
              <DialogDescription>
                {isEditing ? `Actualiza el nombre de esta ${entityName.toLowerCase()}.` : `Crea una nueva ${entityName.toLowerCase()}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input placeholder={`Ej: Mantenimiento`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {assignedProperty && (
                <div className="rounded-lg border bg-muted/40 p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs text-muted-foreground block">Cuenta asignada:</span>
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {assignedProperty.imageUrl ? (
                        <Image
                          src={assignedProperty.imageUrl}
                          alt={assignedProperty.name}
                          width={18}
                          height={18}
                          className="rounded-sm object-cover"
                        />
                      ) : (
                        <Building2 className="h-4 w-4 text-primary" />
                      )}
                      {assignedProperty.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : `Guardar ${entityName}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
