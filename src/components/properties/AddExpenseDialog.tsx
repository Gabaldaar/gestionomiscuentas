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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn, sortWallets } from '@/lib/utils';
import { type ExpenseCategory, type ActualExpense, type Wallet, type Property, type Liability } from '@/lib/types';
import { Loader } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { useAccount } from '../context/AccountProvider';

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
  propertyId: z.string().optional(), // Optional here, but can be required by parent component
  liabilityId: z.string().optional(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;

type AddExpenseDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  expenseCategories: ExpenseCategory[];
  wallets: Wallet[];
  properties?: Property[]; // Make properties optional
  liabilities?: Liability[]; // Make liabilities optional
  onExpenseSubmit: (data: ExpenseFormValues) => void;
  isSubmitting?: boolean;
  expenseToEdit?: Omit<ActualExpense, 'propertyId' | 'propertyName'> | null;
  initialData?: Partial<ExpenseFormValues> | null;
  title?: string;
  description?: string;
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};


export function AddExpenseDialog({
  isOpen,
  onOpenChange,
  expenseCategories,
  wallets,
  properties,
  liabilities,
  onExpenseSubmit,
  isSubmitting = false,
  expenseToEdit,
  initialData,
  title = "Añadir Gasto",
  description = "Registra un nuevo gasto para esta cuenta."
}: AddExpenseDialogProps) {

  const isEditing = !!expenseToEdit;
  const { activeAccountId } = useAccount();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });

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
          propertyId: (expenseToEdit as any).propertyId || '', // Handle potential propertyId
          liabilityId: (expenseToEdit as any).liabilityId || '',
        });
      } else if (initialData) {
        form.reset({
            date: initialData.date || new Date(),
            subcategoryId: initialData.subcategoryId || '',
            walletId: initialData.walletId || '',
            amount: initialData.amount || 0,
            currency: initialData.currency || 'ARS',
            notes: initialData.notes || '',
            propertyId: initialData.propertyId || '',
            liabilityId: initialData.liabilityId || '',
        })
      } else {
          form.reset({
              date: new Date(),
              subcategoryId: '',
              walletId: '',
              amount: 0,
              currency: 'ARS',
              notes: '',
              propertyId: '',
              liabilityId: '',
          });
      }
    }
  }, [isOpen, expenseToEdit, isEditing, initialData, form]);


  const onSubmit = (data: ExpenseFormValues) => {
    onExpenseSubmit(data);
  };
  
  const selectedCurrency = form.watch('currency');
  
  const availableWallets = React.useMemo(() => {
    return wallets
      .filter(wallet => {
        if (wallet.currency !== selectedCurrency) return false;
        if (activeAccountId === 'all') return true;
        if (!wallet.propertyIds || wallet.propertyIds.length === 0) return true;
        return wallet.propertyIds.includes(activeAccountId);
      })
      .sort(sortWallets);
  }, [wallets, selectedCurrency, activeAccountId]);

  const availableLiabilities = liabilities?.filter(l => l.currency === selectedCurrency);
  const isPropertyFixed = !!initialData?.propertyId;


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] grid-rows-[auto_minmax(0,1fr)_auto] p-0 max-h-[90dvh]">
        <DialogHeader className='p-6 pb-0'>
          <DialogTitle>{isEditing ? `Editar ${title}` : title}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Actualiza los detalles de este gasto.` : description}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='h-full'>
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {properties && (
                  <FormField
                      control={form.control}
                      name="propertyId"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Cuenta</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isPropertyFixed || properties.length === 1}>
                              <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una cuenta" />
                              </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                              {properties.map((prop) => (
                                  <SelectItem key={prop.id} value={prop.id}>
                                      {prop.name}
                                  </SelectItem>
                              ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                          </FormItem>
                      )}
                  />
              )}
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
                              format(field.value, 'PP', {locale: es})
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
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedCategories.map((category) => (
                          <SelectGroup key={category.id}>
                            <SelectLabel>{category.name}</SelectLabel>
                            {category.subcategories && category.subcategories.map((subcategory) => (
                              <SelectItem key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                      <Select onValueChange={(value) => { field.onChange(value); form.setValue('walletId', ''); }} value={field.value} defaultValue={field.value}>
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
                name="walletId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billetera</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger disabled={!selectedCurrency}>
                          <SelectValue placeholder={selectedCurrency ? "Selecciona una billetera" : "Elige una moneda primero"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableWallets.map((wallet) => (
                          <SelectItem key={wallet.id} value={wallet.id}>
                            <div className="flex justify-between w-full">
                              <span>{wallet.name}</span>
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
              
              {availableLiabilities && availableLiabilities.length > 0 && (
                  <FormField
                  control={form.control}
                  name="liabilityId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vincular a Pasivo (Opcional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || 'none'} defaultValue={field.value} disabled={!!initialData?.liabilityId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un pasivo para vincular" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguno</SelectItem>
                          {availableLiabilities.map((liability) => (
                            <SelectItem key={liability.id} value={liability.id}>
                              <div className="flex justify-between w-full">
                                  <span>{liability.name}</span>
                                  <span className="text-muted-foreground ml-4">
                                      Saldo: {formatCurrency(liability.outstandingBalance, liability.currency)}
                                  </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
              
            </form>
          </Form>
        </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting} onClick={form.handleSubmit(onSubmit)}>
                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : 'Guardar Gasto'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
