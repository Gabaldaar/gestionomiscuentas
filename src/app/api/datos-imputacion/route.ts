import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { authenticateRequest, corsHeaders } from '../middleware';
import { type IncomeCategory, type Property, type Wallet } from '@/lib/types';

export async function GET(request: Request) {
    try {
        const authError = authenticateRequest(request);
        if (authError) {
            return authError;
        }

        const [categoriesSnap, propertiesSnap, walletsSnap] = await Promise.all([
            adminDb.collection('incomeCategories').orderBy('name').get(),
            adminDb.collection('properties').orderBy('name').get(),
            adminDb.collection('wallets').orderBy('name').get()
        ]);

        const categoriasPromises = categoriesSnap.docs.map(async (categoryDoc) => {
            const categoryData = categoryDoc.data() as Omit<IncomeCategory, 'id'>;
            const subcategoriesSnap = await adminDb.collection('incomeCategories').doc(categoryDoc.id).collection('subcategories').orderBy('name').get();
            
            return subcategoriesSnap.docs.map(subDoc => {
                const subData = subDoc.data();
                return {
                    id: subDoc.id,
                    nombre: `${categoryData.name} / ${subData.name}`
                };
            });
        });

        const nestedCategorias = await Promise.all(categoriasPromises);
        const categorias = nestedCategorias.flat();

        const cuentas = propertiesSnap.docs.map(doc => {
            const data = doc.data() as Omit<Property, 'id'>;
            return { id: doc.id, nombre: data.name };
        });

        const billeteras = walletsSnap.docs.map(doc => {
            const data = doc.data() as Omit<Wallet, 'id'>;
            return { id: doc.id, nombre: data.name };
        });

        return NextResponse.json({
            categorias,
            cuentas,
            billeteras,
        }, { headers: corsHeaders });

    } catch (error) {
        console.error("Error fetching imputation data:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
    }
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
