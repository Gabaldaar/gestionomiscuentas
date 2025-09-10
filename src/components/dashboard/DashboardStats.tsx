import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export function DashboardStats() {
    const stats = [
        { title: "Total Income", value: "$12,345", icon: TrendingUp, color: "text-green-500" },
        { title: "Total Expenses", value: "$8,765", icon: TrendingDown, color: "text-red-500" },
        { title: "Net Balance", value: "$3,580", icon: DollarSign, color: "text-primary" },
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
                            +20.1% from last month
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
