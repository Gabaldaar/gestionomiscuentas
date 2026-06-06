
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
import { type ExpenseCategory, type IncomeCategory, type ExpenseSubcategory, type IncomeSubcategory, type Property } from '@/lib/types';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

const subcategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  propertyIds: z.array(z.string()).optional(),
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
}: ManageSubcategoryDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isEditing = !!subcategoryToEdit;

  const form = useForm<SubcategoryFormValues>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: '',
      propertyIds: [],
    },
  });

  const availableProperties = React.useMemo(() => {
    if (!parentCategory || !parentCategory.propertyIds || parentCategory.propertyIds.length === 0) {
      return properties;
    }
    return properties.filter(p => parentCategory.propertyIds.includes(p.id));
  }, [properties, parentCategory]);

  React.useEffect(() => {
    if (isOpen) {
        const availablePropertyIds = new Set(availableProperties.map(p => p.id));
        const initialPropertyIds = subcategoryToEdit?.propertyIds?.filter(id => availablePropertyIds.has(id)) || [];
        form.reset({
          name: subcategoryToEdit?.name || '',
          propertyIds: initialPropertyIds,
        });
    }
  }, [isOpen, subcategoryToEdit, form, availableProperties]);

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{isEditing ? `Editar ${entityName}` : `Añadir ${entityName}`}</DialogTitle>
              <DialogDescription>
                {isEditing ? `Actualiza el nombre y las cuentas asociadas de esta ${entityName.toLowerCase()}` : `Añade una nueva ${entityName.toLowerCase()} a la categoría "${parentCategory?.name}".`}
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

              <Separator />

              <FormField
                control={form.control}
                name="propertyIds"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">Asociar a Cuentas</FormLabel>
                      <FormDescription>
                        Selecciona las cuentas donde esta subcategoría estará disponible. Solo se muestran las cuentas asignadas a la categoría padre "{parentCategory?.name}".
                      </FormDescription>
                    </div>
                    <div className="flex items-center space-x-2 pb-2">
                        <Checkbox
                          id="select-all-properties-sub"
                          checked={form.getValues('propertyIds')?.length === availableProperties.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              form.setValue('propertyIds', availableProperties.map(p => p.id));
                            } else {
                              form.setValue('propertyIds', []);
                            }
                          }}
                        />
                        <label
                          htmlFor="select-all-properties-sub"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Seleccionar todas ({availableProperties.length})
                        </label>
                      </div>
                    <ScrollArea className="h-40 rounded-md border p-4">
                      {availableProperties.map((item) => (
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
