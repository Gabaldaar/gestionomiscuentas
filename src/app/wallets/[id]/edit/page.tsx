'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import Image from 'next/image';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader, AlertTriangle, Building2 } from 'lucide-react';
import { type Wallet, type Property } from '@/lib/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { walletIcons, WalletIcon, type WalletIconName } from '@/lib/wallet-icons';
import { Switch } from '@/components/ui/switch';

const walletSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  propertyId: z.string().min(1, 'Debes seleccionar la cuenta a la que pertenece esta billetera.'),
  balance: z.coerce.number({invalid_type_error: 'El saldo debe ser un número.'}),
  icon: z.string().optional(),
  allowNegativeBalance: z.boolean().optional(),
  order: z.coerce.number().optional(),
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
  const [properties, setProperties] = React.useState<Property[]>([]);

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
  });

  React.useEffect(() => {
    if (!id) return;
    const fetchWallet = async () => {
      setLoading(true);
      try {
        const walletRef = doc(db, 'wallets', id);
        const [walletSnap, propertiesSnap] = await Promise.all([
          getDoc(walletRef),
          getDocs(query(collection(db, 'properties'), orderBy('name')))
        ]);

        const propsList = propertiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
        setProperties(propsList);

        if (walletSnap.exists()) {
          const walletData = walletSnap.data() as Wallet;
          const assignedPropertyId = walletData.propertyId || walletData.propertyIds?.[0] || '';
          
          form.reset({
            name: walletData.name,
            currency: walletData.currency,
            propertyId: assignedPropertyId,
            balance: walletData.balance,
            icon: walletData.icon || 'Wallet',
            allowNegativeBalance: walletData.allowNegativeBalance || false,
            order: walletData.order ?? undefined,
          });
        } else {
          setError("La billetera no existe.");
        }
      } catch (error) {
        console.error("Error fetching wallet:", error);
        setError("No se pudo cargar la billetera.");
        toast({ title: "Error", description: "No se pudo cargar la billetera.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchWallet();
  }, [id, form, toast]);

  const onSubmit = async (data: WalletFormValues) => {
    setIsSubmitting(true);
    try {
      const walletRef = doc(db, 'wallets', id);
      await updateDoc(walletRef, {
        name: data.name,
        currency: data.currency,
        propertyId: data.propertyId,
        propertyIds: [data.propertyId],
        balance: data.balance,
        icon: data.icon,
        allowNegativeBalance: data.allowNegativeBalance,
        order: data.order ?? null,
      });

      toast({
        title: 'Billetera actualizada',
        description: 'Los datos de la billetera se guardaron correctamente.',
      });
      router.push('/wallets');
    } catch (error) {
      console.error('Error updating document: ', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la billetera.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center min-h-[50vh]">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={() => router.push('/wallets')} className="mt-4">
              Volver a Billeteras
            </Button>
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
          <CardTitle>Editar Detalles</CardTitle>
          <CardDescription>
            Modifica la información y la cuenta a la que pertenece esta billetera.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Billetera</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Efectivo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Single Account Association Selector */}
              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta a la que pertenece</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la cuenta dueña" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties.map(property => (
                          <SelectItem key={property.id} value={property.id}>
                            <div className="flex items-center gap-2">
                              {property.imageUrl ? (
                                <Image src={property.imageUrl} alt={property.name} width={18} height={18} className="rounded-sm object-cover" />
                              ) : (
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>{property.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Esta billetera pertenecerá exclusivamente a la cuenta seleccionada.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moneda</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                          <SelectItem value="USD">Dólares (USD)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Saldo Actual</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Orden de Visualización</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Ej: 1" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Icono</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        value={field.value}
                        className="grid grid-cols-4 sm:grid-cols-8 gap-2"
                      >
                        {iconNames.map((name) => (
                          <FormItem key={name}>
                            <FormControl>
                              <RadioGroupItem value={name} className="sr-only" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              <div className={cn(
                                "p-3 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all",
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

              <FormField
                control={form.control}
                name="allowNegativeBalance"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Permitir Saldo Negativo</FormLabel>
                      <FormDescription>
                        Habilitar si la cuenta puede quedar en descubierto o crédito.
                      </FormDescription>
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
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 p-6">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
