
import { PageHeader } from "@/components/shared/PageHeader";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Info } from "lucide-react";

const suggestedExpenseCategories = [
    { title: 'Vivienda', items: ['Alquiler / Hipoteca', 'Expensas / Gastos comunes', 'Servicios (Luz, Gas, Agua)', 'Internet / Cable', 'Reparaciones y Mantenimiento', 'Impuestos Inmobiliarios'] },
    { title: 'Financiación y Deudas', items: ['Pago de Crédito (para Pasivos)', 'Intereses de Tarjeta de Crédito', 'Comisiones Bancarias'] },
    { title: 'Inversiones y Préstamos', items: ['Préstamo Otorgado (para Activos)'] },
    { title: 'Transporte', items: ['Combustible', 'Seguro de Vehículo', 'Mantenimiento de Vehículo', 'Transporte Público'] },
    { title: 'Personal', items: ['Supermercado y Alimentos', 'Salud (Medicina, Farmacia)', 'Educación', 'Ocio y Entretenimiento', 'Vestimenta'] },
    { title: 'Negocio / Cuentas', items: ['Impuestos (Monotributo, etc.)', 'Insumos y Materiales', 'Honorarios Profesionales'] },
];

const suggestedIncomeCategories = [
    { title: 'Operativos', items: ['Alquileres Recibidos', 'Ventas', 'Honorarios Profesionales'] },
    { title: 'Financiación', items: ['Crédito Obtenido (de Pasivos)', 'Cobranza de Préstamo (de Activos)'] },
    { title: 'No Operativos', items: ['Intereses de Inversiones', 'Dividendos', 'Otros Ingresos'] },
];

export default function HelpPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Guía de Uso" />

      <Card>
        <CardHeader>
          <CardTitle>Bienvenido a GestionoMisCuentas</CardTitle>
          <CardDescription>
            Esta guía te ayudará a configurar y aprovechar al máximo la aplicación para tener un control total sobre tus finanzas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-lg font-semibold">Paso 1: Configura tus Billeteras</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                <p className="mb-4">
                  Las billeteras representan tus fuentes de dinero. Ve a <code className="font-semibold text-primary bg-primary/10 px-1 rounded-sm">Billeteras</code> en el menú principal. Aquí puedes registrar las diferentes fuentes que manejas, por ejemplo: "Banco Galicia ARS", "Ahorros USD", "Efectivo". Cada billetera tiene un saldo y una moneda específica.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="text-lg font-semibold">Paso 2: Crea tus Cuentas</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                <p className="mb-4">
                    Ve a <code className="font-semibold text-primary bg-primary/10 px-1 rounded-sm">Cuentas</code> y añade las diferentes unidades de negocio, propiedades o centros de costo que administras (ej: "Apartamento Céntrico", "Actividad Profesional"). Cada cuenta funcionará como un centro de costos y ganancias independiente.
                </p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-lg font-semibold">Paso 3: Configura tus Categorías</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                 <p className="mb-4">
                    Esta es la parte más importante para tener informes claros. Ve a <code className="font-semibold text-primary bg-primary/10 px-1 rounded-sm">Categorías</code> y define tus categorías de <strong>Ingresos</strong> y <strong>Gastos</strong>. Una buena estructura es clave para el análisis financiero.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <h4 className="font-semibold">Categorías de Gastos Sugeridas:</h4>
                        {suggestedExpenseCategories.map(cat => (
                           <div key={cat.title}>
                                <p className="font-medium">{cat.title}</p>
                                <ul className="list-disc pl-5 space-y-1">
                                   {cat.items.map(item => <li key={item}>{item}</li>)}
                                </ul>
                           </div>
                        ))}
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-semibold">Categorías de Ingresos Sugeridas:</h4>
                        {suggestedIncomeCategories.map(cat => (
                           <div key={cat.title}>
                                <p className="font-medium">{cat.title}</p>
                                <ul className="list-disc pl-5 space-y-1">
                                   {cat.items.map(item => <li key={item}>{item}</li>)}
                                </ul>
                           </div>
                        ))}
                    </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger className="text-lg font-semibold">Paso 4: Registra tus Pasivos y Activos</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                <p className="mb-2">
                    Si tienes deudas como créditos o compras a plazo, ve a la sección <code className="font-semibold text-primary bg-primary/10 px-1 rounded-sm">Pasivos</code> para registrarlas. Al registrar los pagos, el sistema los vinculará a la categoría "Pago de Crédito".
                </p>
                 <p className="mb-4">
                    Del mismo modo, si has prestado dinero a otros, ve a <code className="font-semibold text-primary bg-primary/10 px-1 rounded-sm">Activos</code> para registrar estas cuentas por cobrar y llevar un control de los cobros que recibes.
                </p>
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md flex items-start gap-3">
                    <Info className="h-5 w-5 mt-1 flex-shrink-0" />
                    <p>
                        <strong>Importante:</strong> El sistema utiliza categorías específicas para vincular transacciones con Activos y Pasivos. Asegúrate de tener las categorías adecuadas creadas en la sección <code className="font-semibold">Categorías</code>.
                        <ul className="list-disc pl-5 mt-2">
                            <li>Para **Pasivos**: una categoría de gasto como <code className="font-semibold">"Pago de Crédito"</code> y una de ingreso como <code className="font-semibold">"Crédito Obtenido"</code>.</li>
                            <li>Para **Activos**: una categoría de gasto como <code className="font-semibold">"Préstamo Otorgado"</code> y una de ingreso como <code className="font-semibold">"Cobranza de Préstamo"</code>.</li>
                        </ul>
                    </p>
                </div>
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="item-5">
              <AccordionTrigger className="text-lg font-semibold">¡Listo para Empezar!</AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                <p className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 mt-1 text-green-500 flex-shrink-0"/>
                    <span>
                        Con esta configuración inicial, ya puedes empezar a registrar todas tus transacciones desde la página de cada <strong>Cuenta</strong>. Observa cómo tus finanzas cobran vida en el <strong>Dashboard</strong> y obtén análisis detallados en la sección de <strong>Informes</strong>.
                    </span>
                </p>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
