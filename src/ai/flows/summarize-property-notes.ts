'use server';

/**
 * @fileOverview Summarizes property notes using AI.
 *
 * - summarizePropertyNotes - A function that summarizes property notes.
 * - SummarizePropertyNotesInput - The input type for the summarizePropertyNotes function.
 * - SummarizePropertyNotesOutput - The return type for the summarizePropertyNotes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizePropertyNotesInputSchema = z.object({
  notes: z.string().describe('The notes to summarize.'),
});
export type SummarizePropertyNotesInput = z.infer<typeof SummarizePropertyNotesInputSchema>;

const SummarizePropertyNotesOutputSchema = z.object({
  summary: z.string().describe('The summary of the notes.'),
});
export type SummarizePropertyNotesOutput = z.infer<typeof SummarizePropertyNotesOutputSchema>;

export async function summarizePropertyNotes(input: SummarizePropertyNotesInput): Promise<SummarizePropertyNotesOutput> {
  return summarizePropertyNotesFlow(input);
}

const summarizePropertyNotesPrompt = ai.definePrompt({
  name: 'summarizePropertyNotesPrompt',
  input: {schema: SummarizePropertyNotesInputSchema},
  output: {schema: SummarizePropertyNotesOutputSchema},
  prompt: `Summarize the following notes:\n\n{{notes}}`,
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
