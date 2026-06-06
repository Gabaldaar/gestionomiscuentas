
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { type ExpenseCategory, type Property } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';

const categorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  propertyIds: z.array(z.string()).optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type ManageCategoryDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: () => void;
  categoryToEdit?: Pick<ExpenseCategory, 'id' | 'name' | 'propertyIds'> | null;
  collectionPath: string;
  entityName: string;
  properties: Property[];
};

export function ManageCategoryDialog({
  isOpen,
  onOpenChange,
  onSave,
  categoryToEdit,
  collectionPath,
  entityName,
  properties,
}: ManageCategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!categoryToEdit;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      propertyIds: [],
    },
  });

  React.useEffect(() => {
    if (isOpen) {
        form.reset({
          name: categoryToEdit?.name || '',
          propertyIds: categoryToEdit?.propertyIds || []
        });
    }
  }, [isOpen, categoryToEdit, form]);

  const onSubmit = async (data: CategoryFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEditing && categoryToEdit) {
        const categoryRef = doc(db, collectionPath, categoryToEdit.id);
        await updateDoc(categoryRef, data);
        toast({ title: `${entityName} actualizada` });
      } else {
        await addDoc(collection(db, collectionPath), data);
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
                {isEditing ? `Actualiza el nombre y las cuentas asociadas de esta ${entityName.toLowerCase()}.` : `Crea una nueva ${entityName.toLowerCase()}.`}
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
                
                <Separator />

                <FormField
                  control={form.control}
                  name="propertyIds"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">Asociar a Cuentas</FormLabel>
                        <FormDescription>
                          Selecciona las cuentas donde esta categoría estará disponible. Si no seleccionas ninguna, estará disponible para todas.
                        </FormDescription>
                      </div>
                      <div className="flex items-center space-x-2 pb-2">
                          <Checkbox
                            id="select-all-properties-cat"
                            checked={form.getValues('propertyIds')?.length === properties.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                form.setValue('propertyIds', properties.map(p => p.id));
                              } else {
                                form.setValue('propertyIds', []);
                              }
                            }}
                          />
                          <label
                            htmlFor="select-all-properties-cat"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Seleccionar todas
                          </label>
                        </div>
                      <ScrollArea className="h-40 rounded-md border p-4">
                        {properties.map((item) => (
                          <FormField
                            key={item.id}
                            control={form.control}
                            name="propertyIds"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={item.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 mb-3"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(item.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), item.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== item.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {item.name}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
