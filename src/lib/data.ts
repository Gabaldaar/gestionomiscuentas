import { type Property, type Wallet, type ExpenseCategory, type ExpectedExpense, type ActualExpense, type Income, type IncomeCategory } from './types';
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
