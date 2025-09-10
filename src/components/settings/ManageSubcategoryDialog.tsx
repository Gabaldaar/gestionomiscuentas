
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader } from 'lucide-react';

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
import { type ExpenseCategory, type ExpenseSubcategory } from '@/lib/types';

const subcategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
});

type SubcategoryFormValues = z.infer<typeof subcategorySchema>;

type ManageSubcategoryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  parentCategory: Pick<ExpenseCategory, 'id' | 'name'> | null;
  subcategoryToEdit?: ExpenseSubcategory | null;
  collectionPath: string;
  entityName: string;
};

export function ManageSubcategoryDialog({
  isOpen,
  onOpenChange,
  onSave,
  parentCategory,
  subcategoryToEdit,
  collectionPath,
  entityName,
}: ManageSubcategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!subcategoryToEdit;

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
        form.reset({ name: subcategoryToEdit?.name || '' });
    }
  }, [isOpen, subcategoryToEdit, form]);

  const onSubmit = async (data: SubcategoryFormValues) => {
    if (!parentCategory) {
        toast({ title: "Error", description: "Categoría padre no especificada.", variant: "destructive" });
        return;
    }

    setIsSubmitting(true);
    try {
      const subcategoryCollectionPath = `${collectionPath}/${parentCategory.id}/subcategories`;
      if (isEditing && subcategoryToEdit) {
        const subcategoryRef = doc(db, subcategoryCollectionPath, subcategoryToEdit.id);
        await updateDoc(subcategoryRef, data);
        toast({ title: `${entityName} actualizada` });
      } else {
        await addDoc(collection(db, subcategoryCollectionPath), data);
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
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar ${entityName}` : `Añadir ${entityName}`}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Actualiza el nombre de esta ${entityName.toLowerCase()}` : `Añade una nueva ${entityName.toLowerCase()} a la categoría "${parentCategory?.name}".`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
