
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { type ExpenseCategory, type ActualExpense, type Wallet } from '@/lib/types';

const expenseSchema = z.object({
  date: z.date({
    required_error: 'La fecha es obligatoria.',
  }),
  subcategoryId: z.string().min(1, 'La categoría es obligatoria.'),
  walletId: z.string().min(1, 'La billetera es obligatoria.'),
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor que cero.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  notes: z.string().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

type AddExpenseDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expenseCategories: ExpenseCategory[];
  wallets: Wallet[];
  onExpenseSubmit: (data: ExpenseFormValues) => void;
  expenseToEdit?: Omit<ActualExpense, 'propertyId' | 'propertyName'> | null;
  initialData?: Partial<Omit<ActualExpense, 'propertyId' | 'propertyName'>> | null;
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export function AddExpenseDialog({
  isOpen,
  onOpenChange,
  expenseCategories,
  wallets,
  onExpenseSubmit,
  expenseToEdit,
  initialData,
}: AddExpenseDialogProps) {

  const isEditing = !!expenseToEdit;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });
  
  React.useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'walletId') {
        const selectedWallet = wallets.find(w => w.id === value.walletId);
        if (selectedWallet && form.getValues('currency') !== selectedWallet.currency) {
          form.setValue('currency', selectedWallet.currency);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, wallets]);


  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && expenseToEdit) {
        form.reset({
          date: new Date(expenseToEdit.date),
          subcategoryId: expenseToEdit.subcategoryId,
          walletId: expenseToEdit.walletId,
          amount: expenseToEdit.amount,
          currency: expenseToEdit.currency,
          notes: expenseToEdit.notes || '',
        });
      } else if (initialData) {
        form.reset({
            date: initialData.date ? new Date(initialData.date) : new Date(),
            subcategoryId: initialData.subcategoryId || '',
            walletId: initialData.walletId || '',
            amount: initialData.amount || 0,
            currency: initialData.currency || 'ARS',
            notes: initialData.notes || '',
        })
      } else {
          form.reset({
              date: new Date(),
              subcategoryId: '',
              walletId: '',
              amount: 0,
              currency: 'ARS',
              notes: '',
          });
      }
    }
  }, [isOpen, expenseToEdit, isEditing, initialData, form]);


  const onSubmit = (data: ExpenseFormValues) => {
    onExpenseSubmit(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Gasto' : 'Añadir Gasto'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualiza los detalles de este gasto.' : 'Registra un nuevo gasto para esta cuenta.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha</FormLabel>
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
                            format(field.value, 'PPP')
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
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
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
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <React.Fragment key={category.id}>
                          <FormLabel className="px-2 text-xs font-semibold text-muted-foreground">{category.name}</FormLabel>
                          {category.subcategories && category.subcategories.map((subcategory) => (
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
            <FormField
              control={form.control}
              name="walletId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billetera</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una billetera" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          <div className="flex justify-between w-full">
                            <span>{wallet.name} ({wallet.currency})</span>
                            <span className="text-muted-foreground ml-4">{formatCurrency(wallet.balance, wallet.currency)}</span>
                          </div>
                        </SelectItem>
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
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled>
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
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Añade una nota sobre el gasto..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

    