
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ExpenseCategory, type ExpectedExpense } from '@/lib/types';

const expectedExpenseSchema = z.object({
  subcategoryId: z.string().min(1, 'La categoría es obligatoria.'),
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor que cero.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  month: z.coerce.number().min(1, 'El mes es obligatorio.').max(12, 'El mes debe ser válido.'),
  year: z.coerce.number().min(2000, 'El año debe ser válido.'),
});

type ExpectedExpenseFormValues = z.infer<typeof expectedExpenseSchema>;

type AddExpectedExpenseDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expenseCategories: ExpenseCategory[];
  onExpenseSubmit: (data: ExpectedExpenseFormValues) => void;
  expenseToEdit?: ExpectedExpense | null;
};

export function AddExpectedExpenseDialog({
  isOpen,
  onOpenChange,
  expenseCategories,
  onExpenseSubmit,
  expenseToEdit,
}: AddExpectedExpenseDialogProps) {

  const isEditing = !!expenseToEdit;

  const form = useForm<ExpectedExpenseFormValues>({
    resolver: zodResolver(expectedExpenseSchema),
  });

  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && expenseToEdit) {
        form.reset({
          subcategoryId: expenseToEdit.subcategoryId,
          amount: expenseToEdit.amount,
          currency: expenseToEdit.currency,
          month: expenseToEdit.month,
          year: expenseToEdit.year,
        });
      } else {
          form.reset({
              subcategoryId: '',
              amount: 0,
              currency: 'ARS',
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
          });
      }
    }
  }, [isOpen, expenseToEdit, isEditing, form]);


  const onSubmit = (data: ExpectedExpenseFormValues) => {
    onExpenseSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Gasto Previsto' : 'Añadir Gasto Previsto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualiza los detalles de este gasto previsto.' : 'Registra un nuevo gasto previsto para esta propiedad.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Mes</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="Mes" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Año</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="Año" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="subcategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <React.Fragment key={category.id}>
                          <FormLabel className="px-2 text-xs font-semibold text-muted-foreground">{category.name}</FormLabel>
                          {category.subcategories.map((subcategory) => (
                            <SelectItem key={subcategory.id} value={subcategory.id}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Moneda" />
                        </SelectTrigger>
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
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit">{isEditing ? 'Guardar Cambios' : 'Guardar Gasto'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
