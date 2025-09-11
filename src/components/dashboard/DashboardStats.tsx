
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { type Income, type ActualExpense, type Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stats = {
    currency: Currency;
    incomes: Income[];
    expenses: ActualExpense[];
}

type DashboardStatsProps = {
    statsByCurrency: Stats[];
};

const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

export function DashboardStats({ statsByCurrency }: DashboardStatsProps) {

    if (statsByCurrency.length === 0) {
        return (
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    No hay datos de transacciones para el período seleccionado.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {statsByCurrency.map(({ currency, incomes, expenses }) => {
                const totalIncome = incomes.reduce((acc, income) => acc + income.amount, 0);
                const totalExpense = expenses.reduce((acc, expense) => acc + expense.amount, 0);
                const netBalance = totalIncome - totalExpense;

                const currencyColors = {
                    'ARS': 'text-blue-800 dark:text-blue-400',
                    'USD': 'text-green-800 dark:text-green-400',
                };
                
                const netBalanceColor = netBalance < 0 ? 'text-destructive' : currencyColors[currency];

                return (
                    <Card key={currency} className="flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl font-bold font-headline tracking-tight">Resumen en {currency}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                           <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="text-green-500"/> Ingresos</span>
                                <span className="font-bold text-lg text-green-500">{formatCurrency(totalIncome, currency)}</span>
                           </div>
                           <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2"><TrendingDown className="text-red-500"/> Egresos</span>
                                <span className="font-bold text-lg text-red-500">{formatCurrency(totalExpense, currency)}</span>
                           </div>
                           <div className="flex items-center justify-between border-t pt-2 mt-2">
                                <span className="text-sm font-medium flex items-center gap-2"><DollarSign className={netBalanceColor}/> Saldo Neto</span>
                                <span className={cn("font-bold text-xl", netBalanceColor)}>{formatCurrency(netBalance, currency)}</span>
                           </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    );
}
