import { properties, expectedExpenses, actualExpenses, expenseCategories, incomes, wallets } from '@/lib/data';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { PropertyNotes } from '@/components/properties/PropertyNotes';
import { PropertyExpenses } from '@/components/properties/PropertyExpenses';
import { PropertyIncome } from '@/components/properties/PropertyIncome';

export default function PropertyDetailPage({ params }: { params: { id: string } }) {
  const property = properties.find((p) => p.id === params.id);

  if (!property) {
    notFound();
  }
  
  const propertyExpectedExpenses = expectedExpenses.filter(e => e.propertyId === params.id);
  const propertyActualExpenses = actualExpenses.filter(e => e.propertyId === params.id);
  const propertyIncomes = incomes.filter(i => i.propertyId === params.id);


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title={property.name}>
        <Button>
          <Pencil className="mr-2 h-4 w-4" />
          Editar Propiedad
        </Button>
      </PageHeader>

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
              incomes={propertyIncomes}
              wallets={wallets}
            />

            <PropertyExpenses
              expectedExpenses={propertyExpectedExpenses}
              actualExpenses={propertyActualExpenses}
              expenseCategories={expenseCategories}
              wallets={wallets}
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
