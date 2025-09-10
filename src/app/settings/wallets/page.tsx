
'use client';

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { wallets } from "@/lib/data";
import { PlusCircle, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function WalletsSettingsPage() {
  const { toast } = useToast();

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Billeteras">
        <Button onClick={() => toast({ title: "Funcionalidad no implementada" })}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Billetera
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {wallets.map((wallet) => (
          <Card key={wallet.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{wallet.name}</CardTitle>
                <CardDescription>{wallet.currency}</CardDescription>
              </div>
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => toast({ title: "Funcionalidad no implementada" })}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => toast({ title: "Elemento eliminado", variant: "destructive" })}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: wallet.currency }).format(wallet.balance)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
