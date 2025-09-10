import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, Landmark } from "lucide-react";

export default function SettingsPage() {
  const settingsCards = [
    {
      title: "Expense Accounts",
      description: "Manage your expense categories and subcategories.",
      icon: Landmark,
      action: "Manage",
    },
    {
      title: "Wallets",
      description: "Manage your income accounts (ARS, USD).",
      icon: Wallet,
      action: "Manage",
    },
  ];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Settings" />

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
              <Button className="w-full">{card.action}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
