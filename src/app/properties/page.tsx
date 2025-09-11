'use client';

import * as React from 'react';
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Loader, PlusCircle } from "lucide-react";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp, collectionGroup, query } from "firebase/firestore";
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
        const propertiesList: Property[] = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
        
        const incomesQuery = query(collectionGroup(db, 'incomes'));
        const expensesQuery = query(collectionGroup(db, 'actualExpenses'));
        
        const [incomesSnapshot, expensesSnapshot] = await Promise.all([
            getDocs(incomesQuery),
            getDocs(expensesQuery)
        ]);

        const allIncomes: Record<string, Income[]> = {};
        const allExpenses: Record<string, ActualExpense[]> = {};

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        incomesSnapshot.docs.forEach(doc => {
            const income = {...d.data(), id: doc.id, date: (doc.data().date as Timestamp).toDate().toISOString() } as Income;
            const propertyId = doc.ref.parent.parent!.id;
            const incomeDate = new Date(income.date);
            if (incomeDate.getMonth() === currentMonth && incomeDate.getFullYear() === currentYear) {
                if (!allIncomes[propertyId]) {
                    allIncomes[propertyId] = [];
                }
                allIncomes[propertyId].push(income);
            }
        });
        
        expensesSnapshot.docs.forEach(doc => {
            const expense = {...doc.data(), id: doc.id, date: (doc.data().date as Timestamp).toDate().toISOString() } as ActualExpense;
            const propertyId = doc.ref.parent.parent!.id;
            const expenseDate = new Date(expense.date);
            if (expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear) {
                if (!allExpenses[propertyId]) {
                    allExpenses[propertyId] = [];
                }
                allExpenses[propertyId].push(expense);
            }
        });

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
