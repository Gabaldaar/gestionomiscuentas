'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
import { Loader, AlertTriangle } from 'lucide-react';
import { type Wallet } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { walletIcons, WalletIcon, type WalletIconName } from '@/lib/wallet-icons';


const walletSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  balance: z.coerce.number({invalid_type_error: 'El saldo debe ser un número.'}),
  icon: z.string().optional(),
});

type WalletFormValues = z.infer<typeof walletSchema>;
const iconNames = Object.keys(walletIcons) as WalletIconName[];


export default function EditWalletPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
  });

  React.useEffect(() => {
    if (!id) return;
    const fetchWallet = async () => {
      setLoading(true);
      try {
        const walletRef = doc(db, 'wallets', id);
        const walletSnap = await getDoc(walletRef);
        if (walletSnap.exists()) {
          const walletData = walletSnap.data() as Wallet;
          form.reset({
            name: walletData.name,
            currency: walletData.currency,
            balance: walletData.balance,
            icon: walletData.icon || 'Wallet',
          });
        } else {
          setError('No se encontró la billetera.');
        }
      } catch (err) {
        setError('Error al cargar la billetera.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, [id, form]);

  const onSubmit = async (data: WalletFormValues) => {
    setIsSubmitting(true);
    try {
      const walletRef = doc(db, 'wallets', id);
      await updateDoc(walletRef, data);

      toast({
        title: 'Billetera actualizada',
        description: 'La billetera ha sido actualizada exitosamente.',
      });
      router.push('/wallets');
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la billetera.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
            <Card className="max-w-2xl mx-auto w-full">
                <CardHeader>
                    <CardTitle className='text-destructive flex items-center gap-2'>
                        <AlertTriangle/> Error
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{error}</p>
                    <Button onClick={() => router.back()} className="mt-4">Volver</Button>
                </CardContent>
            </Card>
      </div>
    );
  }


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Editar Billetera" />

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Detalles de la Billetera</CardTitle>
          <CardDescription>
            Modifica la información de la billetera, incluyendo su saldo actual.
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="balance"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Saldo Actual</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value} disabled>
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
                 <Button type="button" variant="ghost" onClick={() => router.push('/wallets')}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Cambios
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
