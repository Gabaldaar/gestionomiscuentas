'use server';

/**
 * @fileOverview Este archivo contiene un flujo de Genkit para categorizar transacciones de gastos basado en su descripción.
 *
 * - categorizeExpenseTransaction - Una función que categoriza una transacción de gastos.
 * - CategorizeExpenseTransactionInput - El tipo de entrada para la función categorizeExpenseTransaction.
 * - CategorizeExpenseTransactionOutput - El tipo de retorno para la función categorizeExpenseTransaction.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeExpenseTransactionInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('La descripción de la transacción de gastos.'),
});
export type CategorizeExpenseTransactionInput = z.infer<
  typeof CategorizeExpenseTransactionInputSchema
>;

const CategorizeExpenseTransactionOutputSchema = z.object({
  category: z.string().describe('La categoría predicha del gasto.'),
  subcategory: z
    .string()
    .describe('La subcategoría predicha del gasto.'),
  confidence: z
    .number()
    .describe(
      'La puntuación de confianza (0-1) de la categorización, siendo 1 la más confiable.'
    ),
});
export type CategorizeExpenseTransactionOutput = z.infer<
  typeof CategorizeExpenseTransactionOutputSchema
>;

export async function categorizeExpenseTransaction(
  input: CategorizeExpenseTransactionInput
): Promise<CategorizeExpenseTransactionOutput> {
  return categorizeExpenseTransactionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeExpenseTransactionPrompt',
  input: {schema: CategorizeExpenseTransactionInputSchema},
  output: {schema: CategorizeExpenseTransactionOutputSchema},
  prompt: `Eres un experto asesor financiero especializado en categorización de gastos.

  Dada la siguiente descripción de la transacción, determina la categoría y subcategoría más apropiadas.
  Además, proporciona una puntuación de confianza (0-1) para tu categorización.

  Descripción de la transacción: {{{transactionDescription}}}

  Responde en formato JSON.
  `,
});

const categorizeExpenseTransactionFlow = ai.defineFlow(
  {
    name: 'categorizeExpenseTransactionFlow',
    inputSchema: CategorizeExpenseTransactionInputSchema,
    outputSchema: CategorizeExpenseTransactionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
