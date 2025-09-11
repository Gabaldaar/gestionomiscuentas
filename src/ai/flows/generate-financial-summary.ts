'use server';

/**
 * @fileOverview Un flujo de Genkit que genera un resumen financiero inteligente basado en los datos del usuario.
 *
 * - generateFinancialSummary - La función que genera el análisis.
 * - FinancialSummaryInput - El tipo de entrada para la función.
 * - FinancialSummaryOutput - El tipo de retorno para la función.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialSummaryInputSchema = z.object({
  currency: z.string().describe('La moneda de los datos financieros.'),
  totalIncome: z.number().describe('El total de ingresos para el período.'),
  totalExpense: z.number().describe('El total de gastos para el período.'),
  netBalance: z.number().describe('El saldo neto (ingresos - gastos).'),
  expenseBreakdown: z.array(z.object({
    name: z.string().describe('El nombre de la categoría de gasto.'),
    value: z.number().describe('El monto total para esa categoría.'),
  })).describe('Un desglose de los gastos por categoría principal.'),
});
export type FinancialSummaryInput = z.infer<typeof FinancialSummaryInputSchema>;

const FinancialSummaryOutputSchema = z.object({
    highlight: z.string().describe('El aspecto más destacado o el titular principal del período (ej. "Saldo neto positivo", "Aumento de gastos").'),
    incomeAnalysis: z.string().describe('Un breve análisis sobre los ingresos del período.'),
    expenseAnalysis: z.string().describe('Un análisis detallado de los gastos, mencionando la categoría más alta.'),
    recommendation: z.string().describe('Una recomendación o consejo accionable para el usuario basado en el análisis.'),
});
export type FinancialSummaryOutput = z.infer<typeof FinancialSummaryOutputSchema>;

export async function generateFinancialSummary(
  input: FinancialSummaryInput
): Promise<FinancialSummaryOutput> {
  return financialSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'financialSummaryPrompt',
  input: {schema: FinancialSummaryInputSchema},
  output: {schema: FinancialSummaryOutputSchema},
  prompt: `Eres un asesor financiero experto. Tu tarea es analizar los datos financieros de un usuario para un período específico y proporcionar un resumen claro, conciso y útil.
  Sé directo y amigable en tu tono. No uses más de una oración por cada campo de salida.

  Aquí están los datos financieros en {{{currency}}}:
  - Total de Ingresos: {{{totalIncome}}}
  - Total de Gastos: {{{totalExpense}}}
  - Saldo Neto: {{{netBalance}}}

  Desglose de gastos por categoría:
  {{#each expenseBreakdown}}
  - Categoría: {{name}}, Monto: {{value}}
  {{/each}}

  Basado en estos datos, genera el siguiente análisis:
  - highlight: El titular más importante del período. Menciona el saldo neto.
  - incomeAnalysis: Un breve comentario sobre los ingresos.
  - expenseAnalysis: Analiza los gastos, identificando y mencionando la categoría con el mayor gasto.
  - recommendation: Ofrece un consejo simple y accionable. Si el saldo es positivo, sugiere ahorrar o invertir. Si es negativo, sugiere revisar la categoría de mayor gasto.

  Responde en formato JSON.
  `,
});

const financialSummaryFlow = ai.defineFlow(
  {
    name: 'financialSummaryFlow',
    inputSchema: FinancialSummaryInputSchema,
    outputSchema: FinancialSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
