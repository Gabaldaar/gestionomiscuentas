"use client";

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { summarizePropertyNotes, type SummarizePropertyNotesOutput } from '@/ai/flows/summarize-property-notes';
import { Loader, Sparkles } from 'lucide-react';

export function PropertyNotes({ notes }: { notes: string }) {
  const [summary, setSummary] = React.useState<SummarizePropertyNotesOutput | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await summarizePropertyNotes({ notes });
      setSummary(result);
    } catch (e) {
      setError('No se pudo generar el resumen.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notas de la Propiedad</CardTitle>
        <Button
          variant="outline"
          onClick={handleSummarize}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {summary ? 'Volver a generar resumen' : 'Resumir con IA'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
            <div className="space-y-2">
                <h3 className="font-semibold">Resumen IA</h3>
                <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md border">{summary.summary}</p>
            </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div>
            <h3 className="font-semibold mb-2">Notas Originales</h3>
            <Textarea value={notes} readOnly rows={8} className="bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
