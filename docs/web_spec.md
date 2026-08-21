# WEB_SPEC.MD - ESPECIFICACIÓN TÉCNICA DEL PROYECTO

## 1. INFORMACIÓN DEL PROYECTO
- **Nombre:** Tinyglam - Calzado de Cuero Premium Argentino en Chile (Stock & Reservas en Tiempo Real)
- **Repositorio GitHub:** https://github.com/cristobalsssss/4-stock-zapatos.git
- **Estrategia:** Vibe Coding + AI Skills (n8n) + Backend (Supabase) + Frontend (Vercel)

## 2. ARQUITECTURA DEL SISTEMA
[ FRONTEND (Vercel) ] <---> [ SKILLS ENGINE (n8n en Render) ] <---> [ DATABASE & STORAGE (Supabase) ]

- **Catálogo Público (Tinyglam):** Consultar Stock en tiempo real e interactuar con galería de imágenes multi-ángulo.
- **Panel Admin Movimientos:** Registrar Venta, Devolución, Gestión de Stock e Imágenes.
- **Base de Datos:** 5 Tablas Relacionales + Tablas de Auditoría/Telemetría + Vistas Optimizadas.
- **Almacenamiento (Supabase Storage):** Bucket público oficial `productos-imagenes`.
  - Módulo de carga rápida con actualización automática de `imagen_portada_variante` o `imagen_defecto_url`.

## 3. ENDPOINTS DE PRODUCCIÓN N8N (SKILLS ENGINE)
- **Skill 1 (Consultar Stock):** `https://n8n-backend-finanzas.onrender.com/webhook/consultar-stock`
  - Método: `POST` / `GET`
  - Filtros opcionales: `codigo`, `talla`, `color`, `nombre`, `categoria`, `incluir_precio_interno`.
- **Skill 2 (Registrar Venta):** `https://n8n-backend-finanzas.onrender.com/webhook/registrar-venta`
  - Método: `POST`
  - Payload: `{ variante_id, cantidad, vendedor, medio_pago, precio_aplicado, comision_vendedor, notas, fecha_venta }`
- **Skill 3 (Registrar Devolución):** `https://n8n-backend-finanzas.onrender.com/webhook/registrar-devolucion`
  - Método: `POST`
  - Payload: `{ variante_id, cantidad, motivo, venta_id }`
- **Skill 4 (Crear Reserva):** `https://n8n-backend-finanzas.onrender.com/webhook/crear-reserva`
  - Método: `POST`
  - Payload: `{ codigo_reserva, cliente_nombre, cliente_whatsapp, cliente_comuna, tipo_entrega, variante_id, modelo_codigo, modelo_nombre, color, talla, cantidad, precio_unitario, notas, items }`
  - Estabilización: Generación y propagación estricta de `codigo_reserva` (`#RES-XXXX`). Si n8n presenta latencia o suspensión en Render, aplica automáticamente fallback transaccional directo a Supabase (`public.reservas`).
- **Skill 5 (Cancelar Reserva):** `https://n8n-backend-finanzas.onrender.com/webhook/cancelar-reserva`
  - Método: `POST`
  - Payload: `{ id, reserva_id, motivo, estado: 'Cancelada' }`
  - Resiliencia: Fallback directo de actualización en Supabase.

## 4. LÓGICA FINANCIERA, PRECIOS Y COMISIONES
- `precio_interno`: Precio base oficial de costo/remate para venta directa del dueño/admin.
- `precio_vendedores`: Precio oficial sugerido de venta para vendedores externos.
- **Regla de Venta Directa (Dueño / Admin):**
  - Se aplica `precio_interno`.
  - La comisión calculada es **$0**.
- **Regla de Venta por Vendedor:**
  - Se aplica `precio_vendedores`.
  - La comisión calculada es: **`(precio_vendedores - precio_interno) * cantidad`**.
  - Si se aplica un precio especial manual, la comisión es: **`(precio_aplicado - precio_interno) * cantidad`** (siempre con piso en $0).

## 5. MODELO DE DATOS EN SUPABASE (5 TABLAS BASE)

### Tabla 1: `productos` (Ficha General del Modelo)
- `id` (uuid, PK, default: gen_random_uuid())
- `codigo_modelo` (text, ej: "AA0002", "EC0077", UNIQUE)
- `nombre_fantasia` (text, ej: "Barcelona", "Turín")
- `categoria` (text, ej: "Botines", "Sandalias", "Zapatillas", "Botas", "Zapatos")
- `material` (text, ej: "Cuero 100%")
- `taco_base` (text, ej: "5cm / acrilico")
- `horma` (text, ej: "Normal")
- `info_adicional` (text, ej: "Tachas decorativas")
- `imagen_defecto_url` (text, URL pública en Supabase Storage)
- `created_at` (timestamptz, default: now())
- `updated_at` (timestamptz, default: now())

### Tabla 2: `inventario_variantes` (Stock por Color, Talla y Precios)
- `id` (uuid, PK, default: gen_random_uuid())
- `producto_id` (uuid, FK -> productos.id ON DELETE CASCADE)
- `sku_variante` (text, ej: "AA0002-NEG-38", UNIQUE)
- `color` (text, ej: "Negro", "Suela")
- `talla` (integer, ej: 35, 36, 37, 38, 39, 40)
- `stock_disponible` (integer, default: 0, CHECK stock_disponible >= 0)
- `stock_minimo_alerta` (integer, default: 2)
- `imagen_portada_variante` (text, URL pública de la variante específica)
- `precio_interno` (numeric, ej: 28990)
- `precio_vendedores` (numeric, ej: 39990)
- `created_at` (timestamptz, default: now())
- `updated_at` (timestamptz, default: now())

### Tabla 3: `imagenes_variante` (Galería Multi-Ángulo)
- `id` (uuid, PK, default: gen_random_uuid())
- `variante_id` (uuid, FK -> inventario_variantes.id ON DELETE CASCADE)
- `imagen_url` (text, URL pública en Supabase Storage)
- `angulo_descripcion` (text, ej: "Vista frontal", "Vista suela", "Vista lateral")
- `orden_posicion` (integer, default: 1)
- `created_at` (timestamptz, default: now())

### Tabla 4: `ventas` (Cabecera de Transacciones)
- `id` (uuid, PK, default: gen_random_uuid())
- `fecha_venta` (timestamp with time zone, default: now())
- `vendedor` (text, ej: "admin_stephanie", "camila")
- `medio_pago` (text, ej: "Transferencia", "Efectivo", "Débito")
- `tipo_operacion` (text, default: "Venta" / "Devolución")
- `monto_total` (numeric, default: 0)
- `notas` (text)
- `created_at` (timestamptz, default: now())

### Tabla 5: `detalle_movimientos` (Kardex e Historial de Inventario)
- `id` (uuid, PK, default: gen_random_uuid())
- `venta_id` (uuid, FK -> ventas.id ON DELETE SET NULL, nullable)
- `variante_id` (uuid, FK -> inventario_variantes.id ON DELETE RESTRICT)
- `tipo_movimiento` (text, ej: "Salida Venta", "Entrada Devolucion", "Ingreso Proveedor", "Ajuste Merma")
- `cantidad` (integer, ej: 1, CHECK cantidad > 0)
- `precio_aplicado` (numeric)
- `comision_vendedor` (numeric, delta registrado automáticamente)
- `notas` (text)
- `created_at` (timestamptz, default: now())

### Tabla 6: `reservas` (Gestión de Solicitudes y Pedidos de Clientes)
- `id` (uuid, PK, default: gen_random_uuid())
- `codigo_reserva` (text, ej: "RES-4821", código amigable autogenerado)
- `cliente_nombre` (text, obligatorio)
- `cliente_whatsapp` (text)
- `cliente_comuna` (text)
- `tipo_entrega` (text, default: 'Envío Starken Por Pagar')
- `variante_id` (uuid, FK -> inventario_variantes.id ON DELETE SET NULL, nullable)
- `modelo_codigo` (text)
- `modelo_nombre` (text)
- `color` (text)
- `talla` (text)
- `cantidad` (integer, default: 1, CHECK cantidad > 0)
- `precio_unitario` (numeric, default: 0)
- `estado` (text, default: 'Pendiente', CHECK IN ('Pendiente', 'Completada', 'Cancelada'))
- `notas` (text)
- `created_at` (timestamptz, default: timezone('utc', now()))
- `updated_at` (timestamptz, default: timezone('utc', now()))

### Tabla 7: `configuracion` (Parámetros Dinámicos y Contacto de Tienda)
- `id` (integer, PK, default: 1)
- `telefono_whatsapp` (text, ej: "+569XXXXXXXX", sin números hardcodeados)
- `nombre_vendedora` (text, ej: "Carmen")
- `modalidad_tienda` (text, descripción de venta 100% online y remate de bodega)
- `entregas_locales` (text, detalles de entregas presenciales en Concepción y Penco)
- `envios_nacionales` (text, detalles de envíos Starken Por Pagar a todo Chile)
- `updated_at` (timestamptz, default: timezone('utc', now()))

## 6. FUNCIONALIDADES PROACTIVAS AÑADIDAS POR LA IA

Como experto en arquitectura de software para E-commerce y Gestión de Inventarios de Calzado, se implementaron las siguientes adiciones incrementales y no destructivas:

### 1. Tabla `historial_precios` (Auditoría de Fluctuaciones y Rentabilidad)
- **Problema que resuelve:** En negocios de calzado con modelos de remate y comisiones variables a vendedores, los precios cambian con frecuencia. Esta tabla permite auditar el histórico de cada cambio de `precio_interno` y `precio_vendedores`, fecha exacta y usuario responsable.
- **Campos:** `id`, `variante_id` (FK), `precio_interno_anterior`, `precio_interno_nuevo`, `precio_vendedores_anterior`, `precio_vendedores_nuevo`, `motivo_cambio`, `usuario_responsable`, `fecha_cambio`.

### 2. Trigger `trg_auditar_precio` en `inventario_variantes`
- **Problema que resuelve:** Automatiza al 100% el registro en `historial_precios` cada vez que se ejecuta un `UPDATE` sobre los precios de una variante, garantizando trazabilidad sin intervención humana ni código extra en frontend.

### 3. Trigger `trg_procesar_movimiento_stock` (Kardex Transaccional Autónomo)
- **Problema que resuelve:** 
  1. Descuenta automáticamente el stock en `inventario_variantes` al registrar "Salida Venta" o "Ajuste Merma".
  2. Reintegra stock automáticamente al registrar "Entrada Devolucion" o "Ingreso Proveedor".
  3. Previene sobreventa a nivel de base de datos (`RAISE EXCEPTION` si `stock_disponible < cantidad`), evitando inconsistencias por concurrencia.
  4. Calcula automáticamente la `comision_vendedor` (`precio_aplicado - precio_interno`) si viene en null o 0.

### 4. Tabla `log_busquedas_vistas` (Telemetría de Demanda No Atendida)
- **Problema que resuelve:** Registra qué modelos, tallas o colores buscan los usuarios en el catálogo cuando no hay stock disponible, permitiendo al negocio identificar quiebres de stock en tallas populares (curva 36-38) para planificar compras futuras con proveedores.

### 5. Vista `v_catalogo_resumen` (Optimización Ultra-Rápida de Carga Frontend)
- **Problema que resuelve:** Resuelve el problema del N+1 en frontend agrupando en un único JSON por producto: colores disponibles, tallas disponibles en stock, rango de precios y stock total. Reduce la latencia de carga del catálogo en Vercel a una sola consulta ligera.

### 6. Vista `v_alertas_stock_critico` (Monitoreo de Quiebres de Stock)
- **Problema que resuelve:** Entrega instantáneamente a los administradores la lista de pares en estado 'AGOTADO' (0 pares) o 'CRÍTICO' (<= `stock_minimo_alerta`), facilitando la reposición antes de perder ventas.

### 7. Vista `v_resumen_vendedores` (Liquidación de Comisiones en Tiempo Real)
- **Problema que resuelve:** Totaliza en tiempo real el volumen neto de ventas, pares vendidos, devoluciones y total acumulado de comisiones por vendedor, simplificando la rendición de cuentas periódica.

### 8. Índices de Alto Rendimiento (B-Tree)
- Índices en `codigo_modelo`, `sku_variante`, `producto_id`, `variante_id`, `color`, `talla` y `fecha_venta` para acelerar los filtros del catálogo público y consultas de movimientos en el panel admin.

### 9. Políticas de Seguridad (RLS) y Realtime Activo
- RLS habilitado con políticas de lectura pública para el catálogo y soporte transaccional para simulación de ventas.
- Integración con `supabase_realtime` para actualización en vivo del stock en el catálogo del cliente.

## 7. CARGA Y MIGRACIÓN DE DATOS REALES (ETL)
- **Origen de datos:** `data/inventario_real.xlsx`
- **Mecanismo:** Script Node.js con herencia de celdas combinadas (*Forward Fill*).
- **Resultados de Producción Verificados (0 discrepancias):**
  - `productos`: 84 registros únicos por código de modelo.
  - `colores`: 122 grupos de color únicos.
  - `inventario_variantes`: 732 variantes (combinación modelo + color + 6 tallas).
  - Unidades con stock disponible en bodega: 265 pares distribuidos en 180 variantes activas.

## 8. ALMACENAMIENTO Y GESTIÓN DE IMÁGENES (SUPABASE STORAGE)
- **Bucket Público Oficial:** `productos-imagenes`.
- **Lógica de Asociación por Modelo y Color:**
  - **Foto Principal del Modelo:** Se almacena en `imagen_defecto_url` en la tabla `productos` y actúa como la portada inicial destacada visible en el estado neutro.
  - **Foto de Portada del Color:** Se asocia a nivel de `(producto_id, color)`. Todas las tallas que pertenezcan a ese color comparten automáticamente la misma fotografía de portada en el catálogo.
  - **Galería General por Color:** Al seleccionar un color específico, la galería filtra de manera estricta para mostrar **únicamente** las fotografías pertenecientes a ese color, ocultando fotos de otros colores para garantizar máxima fidelidad visual al cliente.
- **Módulo de Gestión en Panel Admin:**
  - Selector de Modelo y Color.
  - **Grid de Miniaturas Existentes:** Muestra todas las fotos cargadas para el modelo/color actual con opción de eliminación directa (icono papelera) para permitir reemplazo inmediato.
  - **Zona de Drag & Drop:** Carga rápida de nuevas fotografías a Supabase Storage (`productos-imagenes`) y actualización en tiempo real en la base de datos.

## 9. REQUERIMIENTOS DEL FRONTEND (VERCEL)
1. **Ruta Pública (`/`):**
   - **Catálogo Editorial Boutique:** Tarjetas ordenadas por modelo con contenedor de imagen maximizado, filtros en tiempo real por búsqueda de texto, modelo, color y talla disponible.
   - **Estado Inicial Neutro (Revisión #3):**
     * Al cargar la tarjeta o abrir la ficha de detalle, el estado inicial es neutro (`selectedColor = null`, `selectedVariantId = null`).
     * Se muestra únicamente la foto de portada principal del modelo.
    - **Tarjetas de Producto y Regla de Escasez Visual (Revisión #24):**
      * **Regla de Escasez (< 3 pares):** Si el stock total del modelo es menor a 3 pares (`< 3`), muestra el badge destacado `"¡Últimas unidades!"` con animación de alerta. Si el modelo cuenta con 3 o más pares (`>= 3`), se omite el conteo numérico para preservar una presentación limpia y exclusiva (`"Disponible"`).
      * **Selector de Tallas Dinámico (Paso 2):** Mientras no se elija color, muestra `"2. Talla (selecciona color primero)"`. Al seleccionar color, el encabezado conmuta de inmediato a `"2. Seleccionar talla en color [Color]:"`.
      * **Auto-Apertura de Bolsa:** Al presionar "Reservar" (desde tarjeta o modal), la bolsa de reserva se abre de inmediato en pantalla.
    - **Bolsa de Reserva, Micro-copys de Confianza & WhatsApp Directo (Revisión #25):** Drawer de reserva donde el cliente añade pares seleccionados.
      * **Refuerzo de Confianza Sin Pago Inmediato:** Debajo del total a reservar, se destaca la tarjeta: *"🔒 Reserva gratuita • Sin pago inmediato. Tu par queda apartado en el sistema; nuestra vendedora te contactará por WhatsApp para coordinar el método de pago y entrega."*
      * **Botón Tranquilizador:** `"Confirmar Reserva por WhatsApp"`.
      * **Captura Normalizada de Datos & Generación Infalible de Código:** Formulario con Nombre, Teléfono WhatsApp (con prefijo pre-llenado `+56 9 ` para autocompletar 8 dígitos) y Comuna/Ciudad, seleccionando modalidad (Entrega presencial en Concepción/Penco o Envío Starken Por Pagar). Al enviar, genera el código amigable `#RES-XXXX`, normaliza los calzados con `variante_id`, `modelo_codigo`, `modelo_nombre`, `color`, `talla`, `cantidad` y `precio_unitario`, persiste de forma asíncrona en Supabase y n8n (`crearReserva`), abre `wa.me` hacia el número oficial configurado con el formato Tinyglam y vacía de inmediato la bolsa de compras.
    - **Widget de Chatbot Asistente 100% Local con Búsqueda por Categoría (Revisión #25):** Chatbot flotante interactivo en la esquina inferior derecha (`/`), contextualizado sobre la tienda Tinyglam y ejecutado 100% en cliente sin llamadas residuales ni dependencias de endpoints externos.
      * **Micro-Copy de Reserva Segura:** En el formulario de confirmación, se incluye la nota: *"💡 Recuerda: Tu calzado queda apartado al instante sin cobro previo. Coordinaremos el pago y despacho directamente por WhatsApp."*
      * **Búsqueda Cruzada por Categoría y Talla:** Parser inteligente que detecta intenciones por categoría (*zapatillas, botines, sandalias, botas, zapatos*). Si el usuario consulta (ej: *"tienes zapatillas talla 38"*), filtra estrictamente por `categoria = 'Zapatillas'` y `stock_disponible > 0` en esa talla.
      * **Botón "Ver Catálogo":** Cada tarjeta de calzado sugerido en el chat dispone de los botones interactivos `[👁️ Ver Catálogo]` y `[🛍️ Reservar]`.
      * **FAQ Prioritaria de Envíos y Modalidad:** Intercepta directamente consultas sobre envíos ("🚚 Envíos", "despachos", "Starken", "Chilexpress", "entregas") respondiendo de inmediato con el desglose oficial de entregas presenciales (Concepción/Penco sin costo) y envíos nacionales por pagar en 24-48 hrs, sin realizar búsquedas erróneas de calzado.
      * **Memoria Acumulativa (Slot Filling):** Mantiene en memoria el contexto de la conversación (modelo, categoría, color, presupuesto, talla).
      * **Motor Universal de Precios:** Parser matemático que normaliza expresiones (*"más de 60 mil"*, *"60k"*, *"hasta 40.000"*, *"sobre 50 mil"*, *"entre 30 y 45 mil"*) contra `precio_vendedores` con stock disponible > 0.
      * **Preview Visual en Reserva de Chat:** Al presionar "Reservar" en una tarjeta del chat, la cabecera del formulario muestra una mini tarjeta con foto, código, nombre, variante seleccionada y precio antes de solicitar los datos.
      * **Código Único `#RES-XXXX`:** Cada reserva genera su código único visible en el chat, en el mensaje preformateado de WhatsApp y en el panel administrativo.
      * **Paginación Interactiva ("Ver más"):** Muestra 4 tarjetas a la vez con indicador (*"Mostrando 4 de X calzados disponibles"*) y botón interactivo `[✨ Ver 4 modelos más]`.
      * **Sincronización Reactiva Global (`useTiendaConfig`):** Cambios de vendedora o WhatsApp en /admin se reflejan de inmediato en toda la interfaz sin recargar.
    - **Armonización Visual de Marca & Optimización Mobile-First (Revisión #25 / #26):**
      * **Navbar Header Compacto:** Altura optimizada (`h-14 sm:h-16`) con micro-banner superior condensado y logo responsivo (`h-8 sm:h-10 md:h-11`) con fallback tipográfico refinado.
      * **Hero Banner Dual (Regla "Above the Fold"):**
        - **En Móvil (`< md`):** Encabezado boutique compacto en tonos claros/marfil con borde sutil (`bg-gradient-to-r from-amber-50/80 via-white to-rose-50/70 py-2.5 px-3.5`), logo nítido (`h-7 sm:h-8`), título y slogan en una sola línea, omitiendo párrafos largos para garantizar que la primera fila del catálogo quede visible en el 35% superior de la pantalla sin requerir scroll.
        - **En Escritorio (`>= md`):** Hero editorial premium con fondo estilizado oscuro, contenedor translúcido para el logo oficial y micro-copy completo de reserva sin pago inmediato.
      * **Pastilla / Pill Badge Callout en Chatbot:** Botón flotante enriquecido con pastilla interactiva (`✨ ¿Dudas de stock?`) en fondo blanco con borde boutique, destello sutil e indicador de actividad en verde esmeralda, que al hacer clic despliega el asistente virtual y se oculta automáticamente con la ventana abierta.

2. **Ruta Privada (`/admin`):**
   - **Acceso Protegido por PIN & Sesión Persistente (Revisión #16.1):** Autenticación por contraseña configurada en `VITE_ADMIN_PASSWORD` (por defecto `Tiny1234` / `Gaspi.123#2026`). Al autenticarse, persiste el token de sesión en `sessionStorage.getItem('admin_auth')` para evitar deslogueos al recargar la página, incluyendo botón visible de **"Cerrar Sesión"** en la cabecera del panel.
   - **Auto-Polling & Reactividad Total Cero Shift+F5 (Revisión #17):**
     * **Auto-Polling en segundo plano:** `setInterval` a 20 segundos que consulta silenciosamente cambios en reservas, movimientos y catálogo.
     * **Botón Destacado `🔄 Actualizar Datos`:** En la cabecera superior con feedback de spinner giratorio durante la sincronización activa.
     * **Bypass de Caché:** Headers `Cache-Control: no-cache, no-store, must-revalidate` y `Pragma: no-cache` en todas las operaciones de API.
   - **Módulo de Venta Multi-Producto y Vendedores Fijos (Revisión #16):** Selector de vendedor acotado exclusivamente a **`Camila`** (vendedora externa con cálculo de comisión) y **`Venta Interna`** ($0 comisión), con campo editable de "Monto de Venta Real / Cobrado" por calzado y recálculo de comisiones en vivo.
   - **Flujo de Conversión "Convertir a Venta" Atómico y Seguro (Versión 4.0.0):** Al presionar "Convertir a Venta" en una reserva, `handleConvertirReservaAVenta` extrae y resuelve en orden prioritario la variante por `variante_id`, lista híbrida `shoes` o `modelo_codigo` + `color` + `talla`. Carga de inmediato en `saleItems` con su stock real y precio, asociando `convertingReservaId` y notas con `#RES-XXXX`. Al presionar "Confirmar Venta", se ejecuta el `UPDATE` atómico completando la reserva en Supabase sin alertas de items faltantes.
   - **Pestaña "📋 Reservas" con Mapeo Nativo e Híbrido (Versión 4.0.0):** `renderDetalleReserva` inspecciona columnas planas nativas (`modelo_codigo`, `modelo_nombre`, `variante_id`, `color`, `talla`, `cantidad`, `precio_unitario`) y array `items`, cruzando con el catálogo de variantes para mostrar siempre el nombre de fantasía y código real. Renderiza las viñetas (`• [Nombre Fantasía] ([Código]) - [Color], T[Talla] x [Cant]`), y por separado debajo el badge de modalidad (`📍 Presencial/Envío`) y el badge de notas (`📝 Nota: [Texto]`).
   - **Pestaña "Detalle de Movimientos" (Kardex Integral con 🟢 VENTA y 🔵 DEVOLUCIÓN):** Auditoría visual en tiempo real de `detalle_movimientos` con badges diferenciados: 🟢 **VENTA** (-1 stock) con su ID de venta y botón de 1 clic para "Copiar ID", y 🔵 **DEVOLUCIÓN** (+1 stock) mostrando la referencia a la venta original (`venta_id`), motivo y fecha de operación. Refresco automático reactivo tras registrar devoluciones o ventas.
   - **Pestaña "⚙️ Parámetros" y Zona de Peligro:** Configuración persistente del teléfono WhatsApp oficial de ventas, nombre de la vendedora de contacto, modalidad de la tienda, entregas locales y envíos nacionales con alerta visual si el número no está configurado, y botón de **"🧹 Purgar Datos de Prueba (Reservas y Ventas)"** para resetear transacciones manteniendo 100% blindado el catálogo base (`productos`, `inventario_variantes`, `imagenes_variante`, `configuracion`).
   - **Módulo de Devoluciones con Selector Dual de Criterio (Revisión #16.1):** Selector tipo pestañas/radio superior:
     * **Opción A: 📋 Desde Venta Registrada (Recomendado):** Desplegable con las ventas completadas ordenadas de la más reciente a la más antigua con formato `[#VTA-XXXX] • [Fecha] • [Vendedor] • [Modelo] ([Color] [Talla]) ($[Monto])`, precargando automáticamente variante, cantidad, motivo y referencia ID.
     * **Opción B: 👟 Por Variante / Catálogo Directo (Manual):** Selector libre sobre todas las variantes del catálogo de bodega para ajustes o devoluciones de ventas no registradas.
   - **Gestor de Fotos & Galería General:** Previsualización de fotos existentes por modelo/color y zona de Drag & Drop para carga y reemplazo.
   - **Panel Analítico y Alertas:** Monitor de stock crítico (<= 2 pares o agotados) y resumen de métricas generales.