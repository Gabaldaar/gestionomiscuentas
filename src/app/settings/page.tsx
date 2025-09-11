import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Landmark, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const settingsCards = [
    {
      title: "Categorías de Gastos",
      description: "Administra tus categorías y subcategorías de gastos.",
      icon: Landmark,
      action: "Administrar",
      href: "/settings/expenses"
    },
    {
      title: "Categorías de Ingresos",
      description: "Administra tus categorías y subcategorías de ingresos.",
      icon: TrendingUp,
      action: "Administrar",
      href: "/settings/incomes"
    },
    {
      title: "Billeteras",
      description: "Administra tus cuentas de ingresos (ARS, USD).",
      icon: Wallet,
      action: "Administrar",
      href: "/settings/wallets"
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Configuración" />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {settingsCards.map((card, index) => (
          <Card key={index} className="flex flex-col">
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="bg-primary/10 p-3 rounded-md">
                    <card.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle className="font-headline">{card.title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href={card.href}>{card.action}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
