
'use client';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { incomeCategories } from "@/lib/data";
import { PlusCircle, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function IncomeSettingsPage() {
  const { toast } = useToast();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Cuentas de Ingresos">
        <Button onClick={() => toast({ title: "Funcionalidad no implementada" })}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Categoría
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {incomeCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{category.name}</CardTitle>
              <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={() => toast({ title: "Funcionalidad no implementada" })}>
                    <PlusCircle className="h-4 w-4" />
                    <span className="sr-only">Añadir Subcategoría</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => toast({ title: "Funcionalidad no implementada" })}>
                  <Pencil className="h-4 w-4" />
                   <span className="sr-only">Editar Categoría</span>
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => toast({ title: "Elemento eliminado", variant: "destructive" })}>
                  <Trash2 className="h-4 w-4" />
                   <span className="sr-only">Eliminar Categoría</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {category.subcategories.map((subcategory) => (
                  <li key={subcategory.id} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                    <span>{subcategory.name}</span>
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Funcionalidad no implementada" })}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar Subcategoría</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => toast({ title: "Elemento eliminado", variant: "destructive" })}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar Subcategoría</span>
                        </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
