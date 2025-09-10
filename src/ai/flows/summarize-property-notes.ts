'use server';

/**
 * @fileOverview Resume las notas de una propiedad usando IA.
 *
 * - summarizePropertyNotes - Una función que resume las notas de una propiedad.
 * - SummarizePropertyNotesInput - El tipo de entrada para la función summarizePropertyNotes.
 * - SummarizePropertyNotesOutput - El tipo de retorno para la función summarizePropertyNotes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePropertyNotesInputSchema = z.object({
  notes: z.string().describe('Las notas a resumir.'),
});
export type SummarizePropertyNotesInput = z.infer<typeof SummarizePropertyNotesInputSchema>;

const SummarizePropertyNotesOutputSchema = z.object({
  summary: z.string().describe('El resumen de las notas.'),
});
export type SummarizePropertyNotesOutput = z.infer<typeof SummarizePropertyNotesOutputSchema>;

export async function summarizePropertyNotes(input: SummarizePropertyNotesInput): Promise<SummarizePropertyNotesOutput> {
  return summarizePropertyNotesFlow(input);
}

const summarizePropertyNotesPrompt = ai.definePrompt({
  name: 'summarizePropertyNotesPrompt',
  input: {schema: SummarizePropertyNotesInputSchema},
  output: {schema: SummarizePropertyNotesOutputSchema},
  prompt: `Resume las siguientes notas:\n\n{{notes}}`,
});

const summarizePropertyNotesFlow = ai.defineFlow(
  {
    name: 'summarizePropertyNotesFlow',
    inputSchema: SummarizePropertyNotesInputSchema,
    outputSchema: SummarizePropertyNotesOutputSchema,
  },
  async input => {
    const {output} = await summarizePropertyNotesPrompt(input);
    return output!;
  }
);
