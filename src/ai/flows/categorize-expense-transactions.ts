'use server';

/**
 * @fileOverview This file contains a Genkit flow for categorizing expense transactions based on their description.
 *
 * - categorizeExpenseTransaction - A function that categorizes an expense transaction.
 * - CategorizeExpenseTransactionInput - The input type for the categorizeExpenseTransaction function.
 * - CategorizeExpenseTransactionOutput - The return type for the categorizeExpenseTransaction function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeExpenseTransactionInputSchema = z.object({
  transactionDescription: z
    .string()
    .describe('The description of the expense transaction.'),
});
export type CategorizeExpenseTransactionInput = z.infer<
  typeof CategorizeExpenseTransactionInputSchema
>;

const CategorizeExpenseTransactionOutputSchema = z.object({
  category: z.string().describe('The predicted category of the expense.'),
  subcategory: z
    .string()
    .describe('The predicted subcategory of the expense.'),
  confidence: z
    .number()
    .describe(
      'The confidence score (0-1) of the categorization, with 1 being the most confident.'
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
  prompt: `You are an expert financial advisor specializing in expense categorization.

  Given the following transaction description, determine the most appropriate category and subcategory.
  Also, provide a confidence score (0-1) for your categorization.

  Transaction Description: {{{transactionDescription}}}

  Respond in JSON format.
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
