# TASK_PLAN.MD - HOJA DE RUTA Y PLAN DE EJECUCIÓN

## FASE 1: CONFIGURACIÓN DE ENTORNO Y DOCUMENTACIÓN
- [x] Crear estructura local del proyecto (`4-Stock-Zapatos`)
- [x] Configurar repositorio Git remoto en GitHub (`https://github.com/cristobalsssss/4-stock-zapatos.git`)
- [x] Configurar `.vscode/tasks.json` y `.clinerules`
- [x] Generar documentación de arquitectura en `docs/` (`agents.md`, `web_spec.md`, `task_plan.md`, `project_state.json`)

## FASE 2: DESPLIEGUE EN SUPABASE (BASE DE DATOS Y STORAGE)
- [x] Crear proyecto en Supabase (Plan Free)
- [x] Ejecutar script SQL de creación de las 5 tablas base (`productos`, `inventario_variantes`, `imagenes_variante`, `ventas`, `detalle_movimientos`) + tablas proactivas, triggers de kardex/precios y vistas analíticas
- [x] Crear y configurar como públicos los Buckets `productos` y `productos-imagenes` en Supabase Storage
- [x] Cargar datos iniciales del catálogo mediante script de inicialización (`supabase/seed.sql`)
- [x] Cargar inventario real desde Excel (`data/inventario_real.xlsx`) mediante script ETL con herencia de celdas combinadas (84 modelos, 714 variantes, 253 unidades en stock)

## FASE 3: CONSTRUCCIÓN DE SKILLS DE NEGOCIO EN N8N
- [x] Crear Workflow/Skill 1: `ConsultarStock` (Endpoint REST para obtener disponibilidad por modelo/color/talla)
- [x] Crear Workflow/Skill 2: `RegistrarVentaYDescontarStock` (Registra en `ventas` y `detalle_movimientos`, resta stock y calcula comisión)
- [x] Crear Workflow/Skill 3: `RegistrarDevolucion` (Revierte transacción y suma stock)
- [x] Crear Workflow/Skill 4: `CrearReserva` (Endpoint REST para registro de reservas multi-item con código #RES-XXXX y persistencia)
- [x] Crear Workflow/Skill 5: `CancelarReserva` (Endpoint REST para cancelación y liberación de reservas)

## FASE 4: VIBE CODING DEL FRONTEND EN VERCEL
- [x] Generar estructura inicial del Frontend Web (Catálogo + Admin) en React + Vite + Tailwind CSS
- [x] Conectar vista de catálogo público con Supabase/n8n con buscador y filtros en tiempo real
- [x] Implementar visualizador de variante, alertas de stock y galería modal
- [x] Implementar Bolsa de Reserva con redirección inteligente y mensaje formateado a WhatsApp directo
- [x] Implementar Panel Admin protegido por PIN para venta multi-producto, devoluciones y subida de fotos drag & drop a Storage
- [x] REVISIÓN #1: Asociación de imágenes por Modelo y Color (compartidas por todas las tallas del color)
- [x] REVISIÓN #1: Renombrar y simplificar a "Galería General" sin clasificaciones de ángulos
- [x] REVISIÓN #1: Grid de miniaturas existentes en Admin con opción de eliminación y reemplazo inmediato
- [x] REVISIÓN #1: Validación de contraseña de administrador `Tiny1234`
- [x] REVISIÓN #2: Prioridad de portada principal base del modelo en vista inicial del catálogo
- [x] REVISIÓN #2: Filtrado estricto de galería por color (ocultando fotos de otros colores)
- [x] REVISIÓN #2: Maximización visual y Lightbox / Zoom de pantalla completa con soporte táctil y teclado
- [x] REVISIÓN #3: Estados iniciales neutros (sin preselección de color ni talla) con botón de reserva condicional
- [x] REVISIÓN #3: Zoom interactivo profundo en Lightbox (Desktop: rueda + drag & pan / Móvil: pinch-to-zoom + doble tap)
- [x] REVISIÓN #4: Reseteo sincronizado de zoom al cambiar de foto en carrusel y drag global de ventana
- [x] REVISIÓN #4: Gestos táctiles móviles perfeccionados (touch-action none, pinch-to-zoom fluido, doble tap y swipe)
- [x] REVISIÓN #5: Integración del motor de zoom estándar `react-zoom-pan-pinch` con aislamiento por `key={currentIndex}`
- [x] REVISIÓN #6: Despeje total de capas y eventos en Lightbox (pointer-events-auto en TransformComponent/img, overlays en z-50 e indicador visual)
- [x] REVISIÓN #7: Fullscreen Touch Engine con wrapperStyle/contentStyle al 100%, touch-none global y doble tap a 2.5x
- [x] REVISIÓN #8: Mobile Viewport & Touch Engine Fix (72vh/68vh delimitado, touch-auto y pointer-events-auto en botones z-50)
- [x] REVISIÓN #9: Modal de Venta con Precio Libre y Promociones (Monto Real / Cobrado editable)
- [x] REVISIÓN #9: Pestaña "Detalle de Movimientos" (Kardex en vivo con fechas de operación y registro, badges y filtros)
- [x] REVISIÓN #9: Widget de Chatbot Asistente en catálogo con consulta de stock y derivación a WhatsApp
- [x] REVISIÓN #10: Ajuste de Dueña a "Carmen" ($0 com), entregas presenciales Concepción/Penco y envíos Starken Por Pagar
- [x] REVISIÓN #10: Pestaña "⚙️ Parámetros" para WhatsApp y políticas de entrega configurables
- [x] REVISIÓN #10: Pestaña "📋 Reservas" con ciclo de vida (Pendiente, Cancelada, Convertir a Venta)
- [x] REVISIÓN #10: Formulario de Reserva con prefijo `+56 9 ` y Chatbot con badges interactivos y sugerencias por quiebre de stock
- [x] REVISIÓN #11: Persistencia Real de Reservas en Supabase (`crearReserva`)
- [x] REVISIÓN #11: Sincronización Centralizada de Parámetros (sin números hardcodeados y títulos dinámicos)
- [x] REVISIÓN #11: Tarjetas Visuales Interactivas en Chatbot con Reserva Conversacional Embebida
- [x] REVISIÓN #12: Persistencia Híbrida y Blindada de Reservas en BD y Almacenamiento Local Sincronizado
- [x] REVISIÓN #12: Auditoría y Eliminación Total de Contacto Hardcodeado con Custom Hook `useTiendaConfig`
- [x] REVISIÓN #12: Intención Guiada en Chatbot (Preguntar Talla Primero) y Parser de Precios Exacto
- [x] REVISIÓN #12: Paginación Interactiva en Chatbot ("Ver más modelos")
- [x] REVISIÓN #13: Memoria Conversacional Acumulativa y Slot Filling en Chatbot
- [x] REVISIÓN #13: Motor Universal de Precios y Normalización de Expresiones
- [x] REVISIÓN #13: Preview Visual de Calzado en Formulario de Reserva de Chat
- [x] REVISIÓN #13: Generación de Código Amigable `#RES-XXXX` y Trazabilidad en /admin
- [x] CREACIÓN DE TABLAS EN SUPABASE: Creación y verificación de tabla `reservas` (con código #RES-XXXX, variantes, índices y RLS) y tabla `configuracion` vía script Node.js con `DATABASE_URL`
- [x] REVISIÓN #14: Limpieza total e inmediata de la bolsa de reserva tras confirmar (React state y localStorage)
- [x] REVISIÓN #14: Flujo seguro y atómico de "Convertir a Venta" (reserva se completa solo tras confirmar venta en BD)
- [x] REVISIÓN #14: Script y función de purga de transacciones de prueba (`scripts/limpiar_transacciones_test.js` y botón UI en Admin)
- [x] REVISIÓN #15: Consistencia y deduplicación en Reservas (UPDATE único sin clonar, reactividad en Reservas Activas a 0)
- [x] REVISIÓN #15: Nombre comercial / fantasía en detalles de reserva ("• Viena (AA0005) - Negro, T37 x 1")
- [x] REVISIÓN #15: Columna ID Venta con botón de 1 clic para copiar en Kardex/Movimientos
- [x] REVISIÓN #15: Acción rápida "🔄 Devolver" en Kardex con precarga automática en Devoluciones
- [x] REVISIÓN #16: Estandarización de items en Reservas y badge de entrega sin duplicar modalidad
- [x] REVISIÓN #16: Kardex integral con badges 🟢 VENTA y 🔵 DEVOLUCIÓN y refresco automático reactivo
- [x] REVISIÓN #16: Lista acotada y exclusiva de vendedores: Camila y Venta Interna
- [x] REVISIÓN #16: FAQ contextual prioritario de envíos y tienda física en Chatbot antes de búsquedas
- [ ] Desplegar sitio web en Vercel

## FASE 5: PRUEBAS END-TO-END Y VALIDACIÓN
- [ ] Simular venta completa y validar descuento de stock en tiempo real
- [ ] Validar cálculo de comisión de vendedor
- [ ] Simular devolución y verificar reintegro al inventario