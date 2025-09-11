
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateNavigator } from '../shared/DateNavigator';

export function DashboardFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentMonth = searchParams.get('month') || (new Date().getMonth() + 1).toString();
    const currentYear = searchParams.get('year') || (new Date().getFullYear()).toString();
    const currency = searchParams.get('currency') || 'all';

    const [date, setDate] = React.useState(new Date(parseInt(currentYear), parseInt(currentMonth) - 1, 1));
    const [selectedCurrency, setSelectedCurrency] = React.useState(currency);

    React.useEffect(() => {
        const params = new URLSearchParams();
        params.set('month', (date.getMonth() + 1).toString());
        params.set('year', date.getFullYear().toString());
        if (selectedCurrency !== 'all') {
            params.set('currency', selectedCurrency);
        }
        router.push(`?${params.toString()}`);

    }, [date, selectedCurrency, router]);

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 sm:space-x-2">
            <DateNavigator currentDate={date} onDateChange={setDate} />
            <div className='flex items-center gap-2'>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Todas las monedas" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las monedas</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
