"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function PropertyNotes({ notes }: { notes: string }) {

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas de la Cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
            <Textarea value={notes} readOnly rows={8} className="bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
