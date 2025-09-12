
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { type Income, type Wallet, type IncomeCategory, type Property } from '@/lib/types';
import { Loader } from 'lucide-react';

const incomeSchema = z.object({
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
  assetId: z.string().optional(),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;

type AddIncomeDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wallets: Wallet[];
  incomeCategories: IncomeCategory[];
  properties?: Property[]; // Make properties optional for reuse
  onIncomeSubmit: (data: IncomeFormValues) => void;
  isSubmitting?: boolean;
  incomeToEdit?: Omit<Income, 'propertyId' | 'propertyName'> | null;
  initialData?: Partial<IncomeFormValues> | null;
  title?: string;
  description?: string;
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);
};

export function AddIncomeDialog({
  isOpen,
  onOpenChange,
  wallets,
  incomeCategories,
  properties,
  onIncomeSubmit,
  isSubmitting = false,
  incomeToEdit,
  initialData,
  title = "Añadir Ingreso",
  description = "Registra un nuevo ingreso para esta cuenta."
}: AddIncomeDialogProps) {

  const isEditing = !!incomeToEdit;

  const form = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
  });

  const selectedWalletId = form.watch('walletId');

  React.useEffect(() => {
    if (selectedWalletId) {
      const selectedWallet = wallets.find(w => w.id === selectedWalletId);
      if (selectedWallet && form.getValues('currency') !== selectedWallet.currency) {
        form.setValue('currency', selectedWallet.currency);
      }
    }
  }, [selectedWalletId, wallets, form]);

  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && incomeToEdit) {
        form.reset({
          date: new Date(incomeToEdit.date),
          subcategoryId: incomeToEdit.subcategoryId,
          walletId: incomeToEdit.walletId,
          amount: incomeToEdit.amount,
          currency: incomeToEdit.currency,
          notes: incomeToEdit.notes || '',
          propertyId: (incomeToEdit as any).propertyId || '',
          assetId: (incomeToEdit as any).assetId || '',
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
            assetId: initialData.assetId || '',
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
              assetId: '',
          });
      }
    }
  }, [isOpen, incomeToEdit, isEditing, initialData, form]);


  const onSubmit = (data: IncomeFormValues) => {
    onIncomeSubmit(data);
  };
  
  const selectedCurrency = form.watch('currency');
  const availableWallets = wallets.filter(w => w.currency === selectedCurrency);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar ${title}`: title}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Actualiza los detalles de este ingreso.' : description}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             {properties && properties.length > 1 && (
                 <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Cuenta</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
                      {incomeCategories.map((category) => (
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
                  <FormLabel>Acreditar en Billetera</FormLabel>
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

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Añade una nota sobre el ingreso..." {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                 {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Guardar Cambios' : 'Guardar Ingreso'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
