
'use client';

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortConfig<T> = {
  key: keyof T;
  direction: 'asc' | 'desc';
} | null;

interface SortableHeaderProps<T> extends React.HTMLAttributes<HTMLTableCellElement> {
  label: string;
  sortKey: keyof T;
  sortConfig: SortConfig<T>;
  onSort: (config: SortConfig<T>) => void;
}

export function SortableHeader<T>({
  label,
  sortKey,
  sortConfig,
  onSort,
  className,
  ...props
}: SortableHeaderProps<T>) {
  const isSorted = sortConfig?.key === sortKey;
  const direction = sortConfig?.direction;

  const handleClick = () => {
    let newDirection: 'asc' | 'desc' = 'asc';
    if (isSorted && direction === 'asc') {
      newDirection = 'desc';
    }
    onSort({ key: sortKey, direction: newDirection });
  };

  const Icon = isSorted
    ? direction === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead className={cn("cursor-pointer", className)} onClick={handleClick} {...props}>
      <div className="flex items-center gap-2">
        {label}
        <Icon className="h-4 w-4" />
      </div>
    </TableHead>
  );
}
