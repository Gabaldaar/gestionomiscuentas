
'use client';

import * as React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type DateNavigatorProps = {
  currentDate: Date;
  onDateChange: (newDate: Date) => void;
};

export function DateNavigator({ currentDate, onDateChange }: DateNavigatorProps) {

  const handlePrevMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  const handleGoToCurrentMonth = () => {
    onDateChange(new Date());
  };

  const isCurrentMonth = 
    currentDate.getMonth() === new Date().getMonth() &&
    currentDate.getFullYear() === new Date().getFullYear();

  return (
    <div className="flex items-center justify-center gap-4">
      <Button variant="outline" size="icon" onClick={handlePrevMonth}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Mes anterior</span>
      </Button>

      <div className="flex flex-col items-center">
        <span className="text-lg md:text-xl font-bold font-headline tracking-tight capitalize">
          {format(currentDate, 'MMMM', { locale: es })}
        </span>
        <span className="text-sm text-muted-foreground">
          {format(currentDate, 'yyyy')}
        </span>
      </div>

      <Button variant="outline" size="icon" onClick={handleNextMonth}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Mes siguiente</span>
      </Button>
      
      <Button 
        variant="outline" 
        onClick={handleGoToCurrentMonth}
        disabled={isCurrentMonth}
        className={cn({ 'opacity-50 cursor-not-allowed': isCurrentMonth })}
      >
        <Calendar className="mr-2 h-4 w-4" />
        Hoy
      </Button>
    </div>
  );
}
