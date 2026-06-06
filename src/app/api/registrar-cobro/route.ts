
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { authenticateRequest, corsHeaders } from '../middleware';
import { type Wallet } from '@/lib/types';

const cobroSchema = z.object({
  fecha: z.string().datetime(),
  monto: z.number().positive(),
  moneda: z.enum(['ARS', 'USD']),
  categoria_id: z.string().min(1), // Este ahora será el subcategory_id
  cuenta_id: z.string().min(1),
  billetera_id: z.string().min(1),
  descripcion: z.string().min(1),
  monto_usd: z.number().optional(),
  tasa_cambio: z.number().optional(),
  id_externo: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        const authError = authenticateRequest(request);
        if (authError) {
            return authError;
        }
        
        const body = await request.json();
        const validation = cobroSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos de entrada inválidos.", details: validation.error.format() }, { status: 400, headers: corsHeaders });
        }
        
        const { fecha, monto, moneda, categoria_id, cuenta_id, billetera_id, descripcion, id_externo } = validation.data;
        
        // Use a Firestore transaction for atomicity
        const newIncomeRef = await adminDb.runTransaction(async (transaction) => {
            const cuentaRef = adminDb.collection('properties').doc(cuenta_id);
            const billeteraRef = adminDb.collection('wallets').doc(billetera_id);
            
            const [cuentaSnap, billeteraSnap] = await Promise.all([
                transaction.get(cuentaRef),
                transaction.get(billeteraRef)
            ]);

            if (!cuentaSnap.exists) {
                throw new Error(`La cuenta con id '${cuenta_id}' no es válida.`);
            }
            if (!billeteraSnap.exists) {
                throw new Error(`La billetera con id '${billetera_id}' no es válida.`);
            }
            
            const billeteraData = billeteraSnap.data() as Wallet;
            if(billeteraData.currency !== moneda) {
                throw new Error(`La moneda del cobro (${moneda}) no coincide con la moneda de la billetera (${billeteraData.currency}).`);
            }

            // 1. Crear el registro de ingreso
            const newIncomeRef = adminDb.collection('properties').doc(cuenta_id).collection('incomes').doc();
            const incomeData = {
                amount: monto,
                currency: moneda,
                date: Timestamp.fromDate(new Date(fecha)),
                notes: `Cobro registrado vía API: ${descripcion}` + (id_externo ? ` (ID Externo: ${id_externo})` : ''),
                subcategoryId: categoria_id, // Usamos el ID de la subcategoría
                walletId: billetera_id,
                propertyId: cuenta_id
            };
            transaction.set(newIncomeRef, incomeData);

            // 2. Actualizar el saldo de la billetera
            transaction.update(billeteraRef, { balance: FieldValue.increment(monto) });

            return newIncomeRef;
        });

        return NextResponse.json({ success: true, id_registro_creado: newIncomeRef.id }, { status: 201, headers: corsHeaders });

    } catch (error) {
        console.error("Error registering cobro:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ success: false, error: errorMessage }, { status: 400, headers: corsHeaders });
    }
}


export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
