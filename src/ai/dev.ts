'use server';
/**
 * @fileOverview This file is the entry point for Genkit development.
 *
 * It is used for the Genkit developer UI and for running flows in development.
 * It should not be included in the production build.
 */
import {config} from 'dotenv';
config();

// Flows are imported here for development purposes.
// Do not add flow imports here for production.
