# Requisitos de API para Integración con App de Gestión de Alquileres

Hola,

Para integrar nuestra aplicación de gestión de alquileres con la aplicación de finanzas y así evitar la doble carga de datos, necesitamos que la aplicación de finanzas exponga una API web con las siguientes características.

El objetivo es poder consultar datos (como categorías y cuentas) y registrar nuevos cobros de forma remota.

---

## 1. Autenticación y Seguridad

Todas las peticiones a la API deben estar protegidas para garantizar que solo nuestra aplicación autorizada pueda acceder a ellas.

Proponemos un sistema de autenticación basado en un **Token de API (API Key)**.

-   La API deberá esperar una clave secreta (API Key) en la cabecera (header) `Authorization` de cada petición.
-   El formato debería ser: `Authorization: Bearer <TU_API_KEY_SECRETA>`
-   Las peticiones que no incluyan una API Key válida deberían ser rechazadas con un código de estado `401 Unauthorized`.

---

## 2. Endpoint para Obtener Datos de Imputación

Necesitamos un endpoint para obtener las listas de Categorías, Cuentas de Imputación y Billeteras disponibles en la aplicación de finanzas. Esto nos permitirá mostrar estas opciones en un formulario.

-   **URL sugerida:** `/api/datos-imputacion`
-   **Método HTTP:** `GET`
-   **Autenticación:** Requerida.
-   **Respuesta Exitosa (Código `200 OK`):** Deberá devolver un objeto JSON con la siguiente estructura:

```json
{
  "categorias": [
    { "id": "cat_1", "nombre": "Ingresos por Alquiler" },
    { "id": "cat_2", "nombre": "Servicios" },
    { "id": "cat_3", "nombre": "Otros Ingresos" }
  ],
  "cuentas": [
    { "id": "cta_1", "nombre": "Alquiler Departamento A" },
    { "id": "cta_2", "nombre": "Alquiler Departamento B" }
  ],
  "billeteras": [
    { "id": "bill_1", "nombre": "Caja de Ahorro Pesos" },
    { "id": "bill_2", "nombre": "Cuenta Corriente Dólares" },
    { "id": "bill_3", "nombre": "Efectivo" }
  ]
}
```

---

## 3. Endpoint para Registrar un Nuevo Cobro

Necesitamos un endpoint para enviar la información de un pago (cobro) recibido y que este se registre en la aplicación de finanzas.

-   **URL sugerida:** `/api/registrar-cobro`
-   **Método HTTP:** `POST`
-   **Autenticación:** Requerida.
-   **Cuerpo de la Petición (Request Body):** La petición enviará un objeto JSON con los detalles del cobro. La estructura debería ser la siguiente:

```json
{
  "fecha": "2024-12-25T15:30:00Z",    // Fecha y hora del pago en formato ISO 8601
  "monto": 150.50,                   // Monto del pago
  "moneda": "ARS",                   // Moneda del pago ('ARS' o 'USD')
  "monto_usd": 50.17,                // **Opcional**: Monto convertido a USD (si el pago original fue en ARS)
  "tasa_cambio": 3.00,               // **Opcional**: Tasa de cambio usada si se pagó en ARS
  "categoria_id": "cat_1",           // ID de la Categoría seleccionada
  "cuenta_id": "cta_1",              // ID de la Cuenta de Imputación seleccionada
  "billetera_id": "bill_2",          // ID de la Billetera donde ingresa el dinero
  "descripcion": "Anticipo 30% - Reserva Juan Pérez - Depto Mar", // Descripción del cobro
  "id_externo": "firebase_payment_id_123" // **Opcional pero recomendado**: ID único del pago en nuestra app para evitar duplicados
}
```

-   **Respuesta Exitosa (Código `201 Created` o `200 OK`):** Puede devolver un JSON confirmando la operación, por ejemplo:
    ```json
    {
      "success": true,
      "id_registro_creado": "registro_finanzas_456"
    }
    ```
-   **Respuesta de Error (Códigos `4xx` o `5xx`):** En caso de error (ej. datos inválidos, ID de categoría no encontrado), debería devolver un JSON con un mensaje claro:
    ```json
    {
      "success": false,
      "error": "El ID de la categoría 'cat_x' no es válido."
    }
    ```

---

## Resumen de lo que Necesitamos

1.  Una **API Key secreta** para autenticar las peticiones.
2.  Un **endpoint `GET /api/datos-imputacion`** que devuelva las listas de categorías, cuentas y billeteras.
3.  Un **endpoint `POST /api/registrar-cobro`** que acepte los datos de un nuevo cobro y lo guarde.

Con estos tres elementos, podremos realizar la integración completa. ¡Muchas gracias!
