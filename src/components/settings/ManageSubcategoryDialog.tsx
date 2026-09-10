
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
import { type ExpenseCategory, type IncomeCategory, type ExpenseSubcategory, type IncomeSubcategory, type Property } from '@/lib/types';
import Image from 'next/image';

const subcategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
});

type SubcategoryFormValues = z.infer<typeof subcategorySchema>;

type ManageSubcategoryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  parentCategory: (ExpenseCategory | IncomeCategory) | null;
  subcategoryToEdit?: ExpenseSubcategory | IncomeSubcategory | null;
  collectionPath: string;
  entityName: string;
  properties: Property[];
  defaultPropertyId?: string;
};

export function ManageSubcategoryDialog({
  isOpen,
  onOpenChange,
  onSave,
  parentCategory,
  subcategoryToEdit,
  collectionPath,
  entityName,
  properties,
  defaultPropertyId,
}: ManageSubcategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!subcategoryToEdit;

  // Determine propertyId from parent category, editing subcategory, or default
  const assignedPropertyId = React.useMemo(() => {
    if (subcategoryToEdit?.propertyId) return subcategoryToEdit.propertyId;
    if (subcategoryToEdit?.propertyIds && subcategoryToEdit.propertyIds.length > 0) return subcategoryToEdit.propertyIds[0];
    if (parentCategory?.propertyId) return parentCategory.propertyId;
    if (parentCategory?.propertyIds && parentCategory.propertyIds.length > 0) return parentCategory.propertyIds[0];
    if (defaultPropertyId && defaultPropertyId !== 'all') return defaultPropertyId;
    return properties[0]?.id || '';
  }, [subcategoryToEdit, parentCategory, defaultPropertyId, properties]);

  const assignedProperty = React.useMemo(() => {
    return properties.find(p => p.id === assignedPropertyId);
  }, [properties, assignedPropertyId]);

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        name: subcategoryToEdit?.name || '',
      });
    }
  }, [isOpen, subcategoryToEdit, form]);

  const onSubmit = async (data: SubcategoryFormValues) => {
    if (!parentCategory) {
      toast({ title: "Error", description: "Categoría padre no especificada.", variant: "destructive" });
      return;
    }

    if (!assignedPropertyId) {
      toast({ title: "Error", description: "No se ha podido determinar la cuenta asociada.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        propertyId: assignedPropertyId,
        propertyIds: [assignedPropertyId],
      };

      const subcategoryCollectionPath = `${collectionPath}/${parentCategory.id}/subcategories`;
      if (isEditing && subcategoryToEdit) {
        const subcategoryRef = doc(db, subcategoryCollectionPath, subcategoryToEdit.id);
        await updateDoc(subcategoryRef, payload);
        toast({ title: `${entityName} actualizada` });
      } else {
        await addDoc(collection(db, subcategoryCollectionPath), payload);
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
                {isEditing ? `Actualiza el nombre de esta ${entityName.toLowerCase()}` : `Añade una nueva ${entityName.toLowerCase()} a la categoría "${parentCategory?.name}".`}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Subcategoría</FormLabel>
                    <FormControl>
                      <Input placeholder={`Ej: Electricidad`} {...field} />
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
