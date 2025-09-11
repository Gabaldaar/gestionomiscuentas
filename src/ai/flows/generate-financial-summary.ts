
'use server';

/**
 * @fileOverview Un flujo de Genkit que genera un resumen financiero inteligente basado en los datos del usuario.
 *
 * - generateFinancialSummary - La función que genera el análisis.
 * - FinancialSummaryInput - El tipo de entrada para la función.
 * - FinancialSummaryOutput - El tipo de retorno para la la función.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialSummaryInputSchema = z.object({
  currency: z.string().describe('La moneda de los datos financieros.'),
  currentPeriod: z.string().describe('El período actual que se está analizando (ej. "diciembre 2023").'),
  historicalData: z.array(z.object({
    period: z.string().describe('El período (mes o año).'),
    income: z.number().describe('Total de ingresos para ese período.'),
    expense: z.number().describe('Total de gastos para ese período.'),
    net: z.number().describe('Saldo neto para ese período.'),
  })).describe('Una serie de datos históricos para análisis de tendencias.'),
  expenseBreakdown: z.array(z.object({
    name: z.string().describe('El nombre de la categoría de gasto.'),
    value: z.number().describe('El monto total para esa categoría en el período actual.'),
  })).describe('Un desglose de los gastos por categoría principal para el período actual.'),
});
export type FinancialSummaryInput = z.infer<typeof FinancialSummaryInputSchema>;

const FinancialSummaryOutputSchema = z.object({
    highlight: z.string().describe('El titular o conclusión más importante del análisis del período actual en relación con las tendencias.'),
    trendAnalysis: z.string().describe('Un análisis de las tendencias observadas en los ingresos, gastos y saldo neto de los datos históricos.'),
    currentPeriodAnalysis: z.string().describe('Un análisis detallado del período actual, mencionando la categoría de mayor gasto y comparándolo con las tendencias.'),
    futureSuggestion: z.string().describe('Una sugerencia accionable para los próximos meses basada en las tendencias y el rendimiento actual.'),
    forwardLooking: z.string().describe('Una perspectiva o posible tendencia para el resto del año si los patrones actuales continúan.'),
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
  prompt: `Eres un asesor financiero experto y analista de datos. Tu tarea es analizar una serie de datos financieros históricos de un usuario para identificar tendencias, evaluar el rendimiento del período actual y proporcionar proyecciones y consejos.
  Sé directo, perspicaz y amigable en tu tono. Utiliza una o dos oraciones como máximo para cada campo de salida.

  DATOS FINANCIEROS (Moneda: {{{currency}}})

  Período de enfoque principal: {{{currentPeriod}}}

  Datos Históricos (Ingresos, Gastos, Saldo Neto):
  {{#each historicalData}}
  - Período: {{period}}, Ingresos: {{income}}, Gastos: {{expense}}, Saldo Neto: {{net}}
  {{/each}}

  Desglose de Gastos para el Período Actual ({{{currentPeriod}}}):
  {{#each expenseBreakdown}}
  - Categoría: {{name}}, Monto: {{value}}
  {{/each}}

  Basado en TODOS los datos proporcionados, genera el siguiente análisis en formato JSON:

  - highlight: La conclusión más importante sobre el período actual ({{{currentPeriod}}}) a la luz de las tendencias históricas.
  - trendAnalysis: Describe brevemente la tendencia general que observas en los ingresos, gastos y/o saldo neto durante los últimos meses.
  - currentPeriodAnalysis: Analiza el período actual, identifica la categoría de mayor gasto y compáralo con las tendencias que identificaste. ¿Es un mes típico, mejor o peor que el promedio?
  - futureSuggestion: Ofrece un consejo simple y accionable para los próximos 1-2 meses. Si la tendencia es buena, sugiere cómo mantenerla o mejorarla. Si es mala, sugiere un punto específico a vigilar.
  - forwardLooking: Basado en las tendencias, ofrece una breve perspectiva o proyección para lo que queda del año.
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
