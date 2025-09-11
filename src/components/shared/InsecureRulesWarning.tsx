
'use client';

import * as React from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

const RULES_TO_COPY = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

export function InsecureRulesWarning() {
  const [isSecure, setIsSecure] = React.useState<boolean | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    const checkRules = async () => {
      try {
        // Intentamos leer un documento que no debería existir y al que no deberíamos tener acceso.
        // Si la lectura es exitosa, las reglas son inseguras.
        const testDocRef = doc(db, 'security-test/test-doc');
        await getDoc(testDocRef);
        // Si no hay error, ¡es un problema de seguridad!
        setIsSecure(false);
      } catch (error: any) {
        // Un error de "permission-denied" es lo que esperamos. Significa que las reglas son seguras.
        if (error.code === 'permission-denied') {
          setIsSecure(true);
        } else {
          // Otro tipo de error, lo ignoramos por ahora.
          console.warn('Error al verificar las reglas de seguridad:', error);
          setIsSecure(true); // Asumimos que es seguro si no es un problema de permisos claro.
        }
      }
    };

    checkRules();
  }, []);

  const handleCopyRules = () => {
    navigator.clipboard.writeText(RULES_TO_COPY);
    toast({
      title: 'Copiado al portapapeles',
      description: 'Las reglas de seguridad han sido copiadas. Ahora pégalas en tu consola de Firebase.',
    });
  };

  if (isSecure === null || isSecure === true) {
    // No mostrar nada mientras se verifica o si es seguro
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6 border-2 border-red-500 shadow-lg">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-xl font-bold">¡Atención! Tus Reglas de Seguridad son Inseguras</AlertTitle>
      <AlertDescription className="space-y-4 mt-4 text-base">
        <p>Tu base de datos está actualmente en **modo de prueba**, lo que significa que cualquiera en internet puede leer, modificar o borrar tus datos. Antes de poner tu aplicación en producción, es **crítico** que asegures tu base de datos.</p>
        
        <div>
            <h3 className="font-semibold">Pasos para solucionar:</h3>
            <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>Ve a tu proyecto en la **Consola de Firebase**.</li>
                <li>En el menú, busca **Firestore Database** (o similar).</li>
                <li>Haz clic en la pestaña **"Reglas"** en la parte superior.</li>
                <li>Borra todo el contenido del editor y pega el siguiente código:</li>
            </ol>
        </div>

        <pre className="p-4 rounded-md bg-gray-800 text-white overflow-x-auto text-sm">
            <code>
                {RULES_TO_COPY}
            </code>
        </pre>
        
        <div className="flex items-center gap-4">
            <Button onClick={handleCopyRules}>
                Copiar Código de Reglas
            </Button>
            <p className="text-sm text-muted-foreground">Después de pegar, haz clic en **"Publicar"** en la consola de Firebase.</p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
