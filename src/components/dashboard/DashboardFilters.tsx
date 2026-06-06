

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateNavigator } from '../shared/DateNavigator';
import { type Currency } from '@/lib/types';

export function DashboardFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentMonth = searchParams.get('month') || (new Date().getMonth() + 1).toString();
    const currentYear = searchParams.get('year') || (new Date().getFullYear()).toString();
    const currency = searchParams.get('currency') || 'all';
    
    const [date, setDate] = React.useState(new Date(parseInt(currentYear), parseInt(currentMonth) - 1, 1));
    const [selectedCurrency, setSelectedCurrency] = React.useState<Currency | 'all'>(currency as Currency | 'all');

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
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4">
            <DateNavigator currentDate={date} onDateChange={setDate} />
            <div className='flex items-center gap-2 w-full sm:w-auto'>
                <Select value={selectedCurrency} onValueChange={(value) => setSelectedCurrency(value as Currency | 'all')}>
                    <SelectTrigger className="w-full sm:w-auto">
                    <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
