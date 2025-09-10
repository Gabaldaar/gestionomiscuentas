import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { properties } from "@/lib/data";
import { PropertyCard } from "@/components/properties/PropertyCard";

export default function PropertiesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Propiedades">
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Propiedad
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
