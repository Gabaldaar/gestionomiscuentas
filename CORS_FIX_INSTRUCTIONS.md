# Instrucciones para Corregir Error de Conexión a la API (CORS)

Hola,

Estamos recibiendo un error de conexión al intentar llamar a la API desde la aplicación de alquileres. Esto se debe casi con total seguridad a la política de CORS (Cross-Origin Resource Sharing) del navegador, que bloquea las peticiones entre diferentes dominios si no está configurado explícitamente.

Para solucionarlo, necesitas añadir cabeceras (headers) a las respuestas de **todos los endpoints de la API** (`/api/datos-imputacion` y `/api/registrar-cobro`) para permitir que nuestra aplicación pueda comunicarse.

---

## Solución: Añadir Headers de CORS

En los archivos de tus API Routes en Next.js (ej. `src/app/api/.../route.ts`), debes asegurarte de que la respuesta incluya las siguientes cabeceras:

```
'Access-Control-Allow-Origin': '*'  // O idealmente, el dominio específico de la app de alquileres
'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
'Access-Control-Allow-Headers': 'Content-Type, Authorization'
```

### Ejemplo de Implementación en un Endpoint `GET`

Así es como se vería el código para el endpoint `GET /api/datos-imputacion`:

```typescript
// en /src/app/api/datos-imputacion/route.ts

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // ... (tu lógica actual para obtener los datos)

  const data = {
    categorias: [/* ... */],
    cuentas: [/* ... */],
    billeteras: [/* ... */]
  };

  // Prepara los headers de CORS
  const headers = {
    'Access-Control-Allow-Origin': '*', // Permite cualquier origen
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Devuelve la respuesta con los datos Y los headers
  return NextResponse.json(data, { headers });
}
```

### Ejemplo de Implementación en un Endpoint `POST`

Y así para el endpoint `POST /api/registrar-cobro`:

```typescript
// en /src/app/api/registrar-cobro/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // ... (tu lógica actual para registrar el cobro)
  
  const responseData = {
    success: true,
    id_registro_creado: "some_new_id"
  };

  // Prepara los headers de CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Devuelve la respuesta con los datos Y los headers
  return NextResponse.json(responseData, { headers, status: 201 });
}
```

### Nota sobre `OPTIONS`

Los navegadores a menudo envían una petición preliminar con el método `OPTIONS` antes de un `POST` para verificar los permisos CORS. Es una buena práctica añadir un handler para este método que simplemente devuelva los headers correctos.

```typescript
// En el mismo archivo de la API route

export async function OPTIONS(request: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new Response(null, { headers, status: 204 });
}
```

---

Una vez que apliques estos cambios en los endpoints de la API de finanzas, el problema de conexión debería quedar resuelto.

¡Gracias!
