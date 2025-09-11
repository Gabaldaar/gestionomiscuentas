
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { walletIcons, WalletIcon, type WalletIconName } from '@/lib/wallet-icons';


const walletSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  icon: z.string().optional(),
});

type WalletFormValues = z.infer<typeof walletSchema>;
const iconNames = Object.keys(walletIcons) as WalletIconName[];


export default function NewWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: '',
      currency: 'ARS',
      icon: 'Wallet',
    },
  });

  const onSubmit = async (data: WalletFormValues) => {
    setIsSubmitting(true);
    try {
      const walletData = { 
        ...data,
        balance: 0,
      };

      await addDoc(collection(db, 'wallets'), walletData);
      toast({
        title: 'Billetera creada',
        description: 'La nueva billetera ha sido añadida exitosamente.',
      });
      router.push('/settings/wallets');
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la billetera.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Añadir Nueva Billetera" />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Detalles de la Billetera</CardTitle>
          <CardDescription>
            Completa la información a continuación para registrar una nueva billetera.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Billetera</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Cuenta Principal" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Selecciona un Ícono</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-3 md:grid-cols-6 gap-4"
                      >
                        {iconNames.map((name) => (
                          <FormItem key={name} className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value={name} className="sr-only" />
                            </FormControl>
                            <FormLabel className="font-normal">
                               <div className={cn(
                                  "p-4 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
                                   field.value === name 
                                    ? 'border-primary bg-primary/10' 
                                    : 'border-border hover:border-primary/50'
                                )}>
                                  <WalletIcon name={name} className="h-6 w-6" />
                               </div>
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2">
                 <Button type="button" variant="ghost" onClick={() => router.back()}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Billetera
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
