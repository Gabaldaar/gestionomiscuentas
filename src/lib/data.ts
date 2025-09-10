import { type Property, type Wallet, type ExpenseCategory } from './types';
import { PlaceHolderImages } from './placeholder-images';

export const properties: Property[] = [
  {
    id: 'prop1',
    name: 'Downtown Apartment',
    imageUrl: PlaceHolderImages[0]?.imageUrl || 'https://picsum.photos/seed/prop1/600/400',
    description: 'A modern apartment in the heart of the city. Close to all amenities and public transport.',
    notes: 'Rented by John Doe. Lease ends in 6 months.',
  },
  {
    id: 'prop2',
    name: 'Suburban Family Home',
    imageUrl: PlaceHolderImages[1]?.imageUrl || 'https://picsum.photos/seed/prop2/600/400',
    description: 'Spacious 3-bedroom home with a large backyard. Perfect for families.',
    notes: 'Needs new roof shingles in the next 2-3 years.',
  },
  {
    id: 'prop3',
    name: 'Beachside Condo',
    imageUrl: PlaceHolderImages[2]?.imageUrl || 'https://picsum.photos/seed/prop3/600/400',
    description: 'A beautiful condo with an ocean view. Includes access to a private beach and pool.',
    notes: 'HOA fees are due quarterly.',
  },
];

export const wallets: Wallet[] = [
    { id: 'wallet1', name: 'Main ARS Account', currency: 'ARS', balance: 150000 },
    { id: 'wallet2', name: 'US Dollar Savings', currency: 'USD', balance: 5000 },
    { id: 'wallet3', name: 'Investment ARS', currency: 'ARS', balance: 500000 },
];

export const expenseCategories: ExpenseCategory[] = [
    {
        id: 'cat1',
        name: 'Utilities',
        subcategories: [
            { id: 'sub1', name: 'Electricity' },
            { id: 'sub2', name: 'Gas' },
            { id: 'sub3', name: 'Water' },
            { id: 'sub4', name: 'Internet & TV' },
        ]
    },
    {
        id: 'cat2',
        name: 'Maintenance',
        subcategories: [
            { id: 'sub5', name: 'Repairs' },
            { id: 'sub6', name: 'Gardening' },
            { id: 'sub7', name: 'Plumbing' },
        ]
    },
    {
        id: 'cat3',
        name: 'Taxes & Fees',
        subcategories: [
            { id: 'sub8', name: 'Property Tax' },
            { id: 'sub9', name: 'HOA Fees' },
            { id: 'sub10', name: 'Insurance' },
        ]
    }
];
