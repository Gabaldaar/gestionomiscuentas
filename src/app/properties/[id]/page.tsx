
'use client';

import * as React from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';

import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { PropertyNotes } from '@/components/properties/PropertyNotes';
import { PropertyExpenses } from '@/components/properties/PropertyExpenses';
import { PropertyIncome } from '@/components/properties/PropertyIncome';
import { db } from '@/lib/firebase';
import { type Property } from '@/lib/types';
import { expenseCategories, wallets, incomeCategories } from '@/lib/data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from 'lucide-react';


async function getProperty(id: string): Promise<Property | null> {
  // This function needs to be executed on the server, so we can't use the client-side `db` object directly.
  // For now, we'll assume it's fetched and passed as a prop, or we use a server-side fetch.
  // This is a placeholder for the actual data fetching logic.
  try {
    const docRef = doc(db, "properties", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Property;
    } else {
      return null;
    }
  } catch (error) {
    // This will be caught by the server and potentially result in a 500 error.
    // In a real app, you'd handle this more gracefully.
    console.error("Failed to fetch property:", error);
    return null;
  }
}


export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const [property, setProperty] = React.useState<Property | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState<string>((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = React.useState<string>(new Date().getFullYear().toString());
  const id = params.id;
  
  React.useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      const docRef = doc(db, "properties", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
      } else {
        // Handle not found case, maybe redirect or show a 404 component
        setProperty(null);
      }
      setLoading(false);
    };

    if (id) {
        fetchProperty();
    }
  }, [id]);
  
  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center items-center">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!property) {
    notFound();
  }
  
  const months = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' }
  ];
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title={property.name}>
        <Button>
          <Pencil className="mr-2 h-4 w-4" />
          Editar Propiedad
        </Button>
      </PageHeader>

       <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtros Globales</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Seleccionar año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>


      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
            <Card>
                 <CardContent className="p-0">
                     <Image
                        src={property.imageUrl}
                        alt={property.name}
                        width={800}
                        height={500}
                        className="w-full h-auto object-cover rounded-t-lg"
                        data-ai-hint="apartment building"
                    />
                </CardContent>
            </Card>

            <PropertyIncome
              propertyId={property.id}
              wallets={wallets}
              incomeCategories={incomeCategories}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />

            <PropertyExpenses
              propertyId={property.id}
              expenseCategories={expenseCategories}
              wallets={wallets}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />

            <PropertyNotes notes={property.notes} />
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Resumen Financiero</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No hay datos financieros para mostrar.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">No hay actividad reciente para mostrar.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
