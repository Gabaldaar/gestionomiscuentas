import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Filter } from "lucide-react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { MonthlyComparisonChart } from "@/components/dashboard/MonthlyComparisonChart";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function DashboardPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Panel de Control" />

      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center space-x-2">
           <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className="w-[240px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>Elige una fecha</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las monedas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              <SelectItem value="ars">ARS</SelectItem>
              <SelectItem value="usd">USD</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Aplicar Filtros
          </Button>
        </div>
      </div>
      
      <DashboardStats />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Costos Esperados vs. Reales</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <MonthlyComparisonChart />
          </CardContent>
        </Card>
        <Card className="col-span-4 md:col-span-3">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No hay actividad reciente para mostrar.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
