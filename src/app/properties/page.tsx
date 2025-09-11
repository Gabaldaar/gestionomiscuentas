import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { type Property } from "@/lib/types";
import Link from "next/link";

async function getProperties(): Promise<Property[]> {
  const propertiesCol = collection(db, 'properties');
  const propertiesSnapshot = await getDocs(propertiesCol);
  const propertiesList = propertiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
  return propertiesList;
}

export default async function PropertiesPage() {
  const properties = await getProperties();

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
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  );
}
