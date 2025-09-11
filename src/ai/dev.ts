'use server';
/**
 * @fileOverview This file is the entry point for Genkit development.
 *
 * It is used for the Genkit developer UI and for running flows in development.
 * It should not be included in the production build.
 */
import {config} from 'dotenv';
config();

import '@/ai/flows/categorize-expense-transactions.ts';
import '@/ai/flows/generate-financial-summary.ts';
