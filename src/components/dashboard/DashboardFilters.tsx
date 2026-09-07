

'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateNavigator } from '../shared/DateNavigator';
import { type Currency } from '@/lib/types';

interface DashboardFiltersProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedCurrency: Currency | 'all';
  onCurrencyChange: (currency: Currency | 'all') => void;
}

export function DashboardFilters({
  currentDate,
  onDateChange,
  selectedCurrency,
  onCurrencyChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4">
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />
      <div className='flex items-center gap-2 w-full sm:w-auto'>
        <Select value={selectedCurrency} onValueChange={(value) => onCurrencyChange(value as Currency | 'all')}>
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
