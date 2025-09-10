import { type Property, type Wallet, type ExpenseCategory, type ExpectedExpense, type ActualExpense } from './types';
import { PlaceHolderImages } from './placeholder-images';

export const properties: Property[] = [
  {
    id: 'prop1',
    name: 'Apartamento Céntrico',
    imageUrl: PlaceHolderImages[0]?.imageUrl || 'https://picsum.photos/seed/prop1/600/400',
    description: 'Un apartamento moderno en el corazón de la ciudad. Cerca de todos los servicios y transporte público.',
    notes: 'Alquilado por John Doe. El contrato de arrendamiento finaliza en 6 meses.',
  },
  {
    id: 'prop2',
    name: 'Casa Familiar Suburbana',
    imageUrl: PlaceHolderImages[1]?.imageUrl || 'https://picsum.photos/seed/prop2/600/400',
    description: 'Espaciosa casa de 3 dormitorios con un gran patio trasero. Perfecta para familias.',
    notes: 'Necesita tejas nuevas en el techo en los próximos 2-3 años.',
  },
  {
    id: 'prop3',
    name: 'Condominio Frente a la Playa',
    imageUrl: PlaceHolderImages[2]?.imageUrl || 'https://picsum.photos/seed/prop3/600/400',
    description: 'Un hermoso condominio con vista al mar. Incluye acceso a una playa y piscina privadas.',
    notes: 'Las cuotas de la comunidad de propietarios (HOA) se pagan trimestralmente.',
  },
];

export const wallets: Wallet[] = [
    { id: 'wallet1', name: 'Cuenta Principal ARS', currency: 'ARS', balance: 150000 },
    { id: 'wallet2', name: 'Ahorros en Dólares US', currency: 'USD', balance: 5000 },
    { id: 'wallet3', name: 'Inversión ARS', currency: 'ARS', balance: 500000 },
];

export const expenseCategories: ExpenseCategory[] = [
    {
        id: 'cat1',
        name: 'Servicios Públicos',
        subcategories: [
            { id: 'sub1', name: 'Electricidad' },
            { id: 'sub2', name: 'Gas' },
            { id: 'sub3', name: 'Agua' },
            { id: 'sub4', name: 'Internet y TV' },
        ]
    },
    {
        id: 'cat2',
        name: 'Mantenimiento',
        subcategories: [
            { id: 'sub5', name: 'Reparaciones' },
            { id: 'sub6', name: 'Jardinería' },
            { id: 'sub7', name: 'Plomería' },
        ]
    },
    {
        id: 'cat3',
        name: 'Impuestos y Tasas',
        subcategories: [
            { id: 'sub8', name: 'Impuesto a la Propiedad' },
            { id: 'sub9', name: 'Cuotas de Comunidad' },
            { id: 'sub10', name: 'Seguro' },
        ]
    }
];

export const expectedExpenses: ExpectedExpense[] = [
    { id: 'exp1', propertyId: 'prop1', subcategoryId: 'sub1', amount: 50, currency: 'USD', month: 7, year: 2024 },
    { id: 'exp2', propertyId: 'prop1', subcategoryId: 'sub9', amount: 100, currency: 'USD', month: 7, year: 2024 },
    { id: 'exp3', propertyId: 'prop2', subcategoryId: 'sub6', amount: 8000, currency: 'ARS', month: 7, year: 2024 },
];

export const actualExpenses: ActualExpense[] = [
    { id: 'act1', propertyId: 'prop1', subcategoryId: 'sub1', amount: 55, currency: 'USD', date: '2024-07-15T10:00:00Z', notes: 'Factura de electricidad de julio.' },
    { id: 'act2', propertyId: 'prop2', subcategoryId: 'sub5', amount: 15000, currency: 'ARS', date: '2024-07-10T14:30:00Z', notes: 'Reparación de gotera en el techo.' },
];
