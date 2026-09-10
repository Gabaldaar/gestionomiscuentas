'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
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
  CardFooter,
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
import { Loader, Building2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { walletIcons, WalletIcon, type WalletIconName } from '@/lib/wallet-icons';
import { Switch } from '@/components/ui/switch';
import { type Property } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { useAccount } from '@/components/context/AccountProvider';

const walletSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  currency: z.enum(['ARS', 'USD'], {
    required_error: 'La moneda es obligatoria.',
  }),
  propertyId: z.string().min(1, 'Debes seleccionar la cuenta a la que pertenece esta billetera.'),
  icon: z.string().optional(),
  allowNegativeBalance: z.boolean().optional(),
  order: z.coerce.number().optional(),
});

type WalletFormValues = z.infer<typeof walletSchema>;
const iconNames = Object.keys(walletIcons) as WalletIconName[];

export default function NewWalletPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeAccountId } = useAccount();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [loading, setLoading] = React.useState(true);

  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: '',
      currency: 'ARS',
      propertyId: activeAccountId !== 'all' ? activeAccountId : '',
      icon: 'Wallet',
      allowNegativeBalance: false,
    },
  });
  
  React.useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const propsQuery = query(collection(db, 'properties'), orderBy('name'));
        const propsSnap = await getDocs(propsQuery);
        const propsList = propsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
        setProperties(propsList);
        
        // If active account is set, pre-fill
        if (activeAccountId !== 'all' && propsList.some(p => p.id === activeAccountId)) {
          form.setValue('propertyId', activeAccountId);
        } else if (propsList.length > 0 && !form.getValues('propertyId')) {
          form.setValue('propertyId', propsList[0].id);
        }
      } catch (error) {
        toast({ title: 'Error', description: 'No se pudieron cargar las cuentas.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, [toast, activeAccountId, form]);

  const onSubmit = async (data: WalletFormValues) => {
    setIsSubmitting(true);
    try {
      const walletsCollection = collection(db, 'wallets');
      const walletsSnapshot = await getDocs(walletsCollection);
      const newOrder = (walletsSnapshot.size || 0) + 1;

      await addDoc(walletsCollection, {
        name: data.name,
        currency: data.currency,
        propertyId: data.propertyId,
        propertyIds: [data.propertyId],
        icon: data.icon || 'Wallet',
        allowNegativeBalance: data.allowNegativeBalance || false,
        balance: 0,
        order: data.order || newOrder,
      });

      toast({
        title: 'Billetera creada',
        description: 'La nueva billetera ha sido añadida exitosamente.',
      });
      router.push('/wallets');
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
            Completa la información para registrar una nueva billetera o caja.
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
                      <Input placeholder="Ej: Efectivo, Banco Santander" {...field} />
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
                          <SelectValue placeholder={loading ? "Cargando cuentas..." : "Selecciona la cuenta"} />
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Orden de Visualización (Opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 1" {...field} value={field.value ?? ''} />
                      </FormControl>
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
                    <FormLabel>Icono</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
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
                Guardar Billetera
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
