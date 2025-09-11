import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { type Income, type ActualExpense } from "@/lib/types";

type DashboardStatsProps = {
    incomes: Income[];
    expenses: ActualExpense[];
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export function DashboardStats({ incomes, expenses }: DashboardStatsProps) {
    const totalIncome = incomes.reduce((acc, income) => acc + income.amount, 0);
    const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const currency = incomes[0]?.currency || expenses[0]?.currency || 'ARS';

    const stats = [
        { title: "Ingresos Totales", value: formatCurrency(totalIncome, currency), icon: TrendingUp, color: "text-green-500" },
        { title: "Egresos Totales", value: formatCurrency(totalExpense, currency), icon: TrendingDown, color: "text-red-500" },
        { title: "Saldo Neto", value: formatCurrency(netBalance, currency), icon: DollarSign, color: "text-primary" },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {stat.title}
                        </CardTitle>
                        <stat.icon className={`h-4 w-4 text-muted-foreground ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground">
                            Para el período seleccionado
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
