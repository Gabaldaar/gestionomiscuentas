
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const copySchema = z.object({
  sourceMonth: z.coerce.number().min(1).max(12),
  sourceYear: z.coerce.number().min(2000),
  numberOfMonths: z.coerce.number().min(1, 'Debe ser al menos 1.'),
});

type CopyFormValues = z.infer<typeof copySchema>;

type CopyExpectedExpensesDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (sourceYear: number, sourceMonth: number, numberOfMonths: number) => void;
};

export function CopyExpectedExpensesDialog({
  isOpen,
  onOpenChange,
  onConfirm,
}: CopyExpectedExpensesDialogProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const form = useForm<CopyFormValues>({
    resolver: zodResolver(copySchema),
    defaultValues: {
      sourceMonth: currentMonth,
      sourceYear: currentYear,
      numberOfMonths: 1,
    },
  });

  const onSubmit = (data: CopyFormValues) => {
    onConfirm(data.sourceYear, data.sourceMonth, data.numberOfMonths);
  };
  
  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];
  const years = Array.from({ length: 10 }, (_, i) => (currentYear - 5 + i));


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar Gastos Previstos</DialogTitle>
          <DialogDescription>
            Selecciona el mes de origen y cuántos meses hacia adelante deseas copiar la lista de gastos previstos.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sourceMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mes de Origen</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {months.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sourceYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año de Origen</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value.toString()}>
                       <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Año" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="numberOfMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Copiar a los Próximos X Meses</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ej: 12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">Confirmar Copia</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
