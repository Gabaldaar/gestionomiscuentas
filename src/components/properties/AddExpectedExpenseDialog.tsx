
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type ExpenseCategory, type ExpectedExpense } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { cn } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { useAccount } from '../context/AccountProvider';

const expectedExpenseSchema = z.object({
  subcategoryId: z.string().min(1, 'La categoría es obligatoria.'),
  amount: z.coerce.number().min(0, 'El monto no puede ser negativo.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  date: z.date({
    required_error: 'La fecha de vencimiento es obligatoria.',
  }),
  isPaid: z.boolean().optional(),
  notes: z.string().optional(),
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

  const { activeAccountId } = useAccount();

  const sortedCategories = React.useMemo(() => {
    if (!expenseCategories) return [];
    
    // If we are in "All Accounts" context, don't filter anything.
    if (activeAccountId === 'all') {
      return expenseCategories;
    }

    const isItemVisibleForAccount = (item: { propertyIds?: string[] | null }) => {
      // Is global (visible) if propertyIds is not set or is an empty array.
      if (item.propertyIds == null || item.propertyIds.length === 0) {
        return true;
      }
      // Is visible if the active account is in its list of assigned properties.
      return item.propertyIds.includes(activeAccountId);
    };

    return expenseCategories
      .filter(isItemVisibleForAccount) // 1. Filter parent categories
      .map(cat => {
        // 2. Filter subcategories of the visible parent
        const visibleSubcategories = cat.subcategories.filter(isItemVisibleForAccount);

        // 3. Only include the parent category if it has any visible subcategories left
        if (visibleSubcategories.length > 0) {
          return {
            ...cat,
            subcategories: visibleSubcategories,
          };
        }
        return null;
      })
      .filter((cat): cat is NonNullable<typeof cat> => cat !== null);
  }, [expenseCategories, activeAccountId]);

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
          date: new Date(expenseToEdit.date),
          isPaid: expenseToEdit.isPaid || false,
          notes: expenseToEdit.notes || '',
        });
      } else {
          form.reset({
              subcategoryId: '',
              amount: 0,
              currency: 'ARS',
              date: new Date(),
              isPaid: false,
              notes: '',
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
            {isEditing ? 'Actualiza los detalles de este gasto previsto.' : 'Registra un nuevo gasto previsto para esta cuenta.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Vencimiento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PP', { locale: es })
                          ) : (
                            <span>Elige una fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      {sortedCategories.map((category) => (
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
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Agrega comentarios o detalles adicionales..." 
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Marcar como Pagado</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
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
