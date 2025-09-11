'use client';

import * as React from 'react';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader, PlusCircle } from "lucide-react";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { type Property, type Income, type ActualExpense } from "@/lib/types";
import Link from "next/link";
import { useToast } from '@/hooks/use-toast';

type PropertiesData = {
  properties: Property[];
  incomes: Record<string, Income[]>;
  expenses: Record<string, ActualExpense[]>;
};

export default function PropertiesPage() {
  const [data, setData] = React.useState<PropertiesData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    async function getPropertiesData() {
      setLoading(true);
      try {
        const propertiesCol = collection(db, 'properties');
        const propertiesSnapshot = await getDocs(propertiesCol);
        
        const propertiesList: Property[] = [];
        const allIncomes: Record<string, Income[]> = {};
        const allExpenses: Record<string, ActualExpense[]> = {};
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        for (const doc of propertiesSnapshot.docs) {
          const property = { id: doc.id, ...doc.data() } as Property;
          propertiesList.push(property);

          const incomesCol = collection(db, 'properties', doc.id, 'incomes');
          const incomesSnapshot = await getDocs(incomesCol);
          allIncomes[doc.id] = incomesSnapshot.docs
            .map(d => ({...d.data(), id: d.id, date: (d.data().date as Timestamp).toDate().toISOString() } as Income))
            .filter(income => {
                const incomeDate = new Date(income.date);
                return incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear;
            });

          const expensesCol = collection(db, 'properties', doc.id, 'actualExpenses');
          const expensesSnapshot = await getDocs(expensesCol);
          allExpenses[doc.id] = expensesSnapshot.docs
            .map(d => ({...d.data(), id: d.id, date: (d.data().date as Timestamp).toDate().toISOString() } as ActualExpense))
            .filter(expense => {
                const expenseDate = new Date(expense.date);
                return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
            });
        }
        setData({ properties: propertiesList, incomes: allIncomes, expenses: allExpenses });
      } catch (error) {
        console.error("Error fetching properties:", error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las cuentas.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    getPropertiesData();
  }, [toast]);

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <PageHeader title="Cuentas" />
        <p>Error al cargar las cuentas.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Cuentas">
        <Button asChild>
          <Link href="/properties/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Cuenta
          </Link>
        </Button>
      </PageHeader>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {data.properties.map((property) => (
          <PropertyCard 
            key={property.id} 
            property={property}
            incomes={data.incomes[property.id] || []}
            expenses={data.expenses[property.id] || []}
          />
        ))}
      </div>
    </div>
  );
}
