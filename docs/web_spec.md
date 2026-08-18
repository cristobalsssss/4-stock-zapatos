# WEB_SPEC.MD - ESPECIFICACIÓN TÉCNICA DEL PROYECTO

## 1. INFORMACIÓN DEL PROYECTO
- **Nombre:** Mantenedor de Stock de Zapatos y Registro de Movimientos (Ejercicio 3)
- **Repositorio GitHub:** https://github.com/cristobalsssss/4-stock-zapatos.git
- **Estrategia:** Vibe Coding + AI Skills (n8n) + Backend (Supabase) + Frontend (Vercel)

## 2. ARQUITECTURA DEL SISTEMA
\[ FRONTEND (Vercel) \] <---> \[ SKILLS ENGINE (n8n en Render) \] <---> \[ DATABASE & STORAGE (Supabase) \]

- **Catálogo Público:** Consultar Stock en tiempo real e interactuar con galería de imágenes.
- **Panel Admin Movimientos:** Registrar Venta, Devolución, Gestión de Stock e Imágenes.
- **Base de Datos:** 5 Tablas Relacionales + Tablas de Auditoría/Telemetría + Vistas Optimizadas.
- **Almacenamiento (Supabase Storage):** Bucket público `calzado-imagenes` (y buckets auxiliares `productos`, `productos-imagenes`).
  - Módulo de carga rápida con actualización automática de `imagen_portada_variante` o `imagen_defecto_url`.

## 3. ENDPOINTS DE PRODUCCIÓN N8N (SKILLS ENGINE)
- **Skill 1 (Consultar Stock):** `https://n8n-backend-finanzas.onrender.com/webhook/consultar-stock`
  - Método: `POST` / `GET`
  - Filtros opcionales: `codigo`, `talla`, `color`, `nombre`, `incluir_precio_interno`.
- **Skill 2 (Registrar Venta):** `https://n8n-backend-finanzas.onrender.com/webhook/registrar-venta`
  - Método: `POST`
  - Payload: `{ variante_id, cantidad, vendedor, medio_pago, precio_aplicado, comision_vendedor, notas }`
- **Skill 3 (Registrar Devolución):** `https://n8n-backend-finanzas.onrender.com/webhook/registrar-devolucion`
  - Método: `POST`
  - Payload: `{ variante_id, cantidad, motivo, venta_id }`

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
- **Resultados de Producción:**
  - `productos`: 84 registros únicos por código de modelo.
  - `inventario_variantes`: 714 variantes (combinación modelo + color + talla).
  - Unidades con stock disponible en bodega: 253 pares distribuidos en 173 variantes activas.

## 8. ALMACENAMIENTO Y GESTIÓN DE IMÁGENES (SUPABASE STORAGE)
- **Bucket Público Principal:** `productos-imagenes` (y bucket de respaldo `calzado-imagenes`).
- **Lógica de Asociación por Modelo y Color:**
  - **Foto Principal del Modelo:** Se almacena en `imagen_defecto_url` en la tabla `productos` y actúa como la portada inicial destacada visible en el estado neutro.
  - **Foto de Portada del Color:** Se asocia a nivel de `(producto_id, color)`. Todas las tallas que pertenezcan a ese color comparten automáticamente la misma fotografía de portada en el catálogo.
  - **Galería General por Color:** Al seleccionar un color específico, la galería filtra de manera estricta para mostrar **únicamente** las fotografías pertenecientes a ese color, ocultando fotos de otros colores para garantizar máxima fidelidad visual al cliente.
- **Módulo de Gestión en Panel Admin:**
  - Selector de Modelo y Color.
  - **Grid de Miniaturas Existentes:** Muestra todas las fotos cargadas para el modelo/color actual con opción de eliminación directa (icono papelera) para permitir reemplazo inmediato.
  - **Zona de Drag & Drop:** Carga rápida de nuevas fotografías a Supabase Storage y actualización en tiempo real en la base de datos.

## 9. REQUERIMIENTOS DEL FRONTEND (VERCEL)
1. **Ruta Pública (`/`):**
   - **Catálogo Editorial Boutique:** Tarjetas ordenadas por modelo con contenedor de imagen maximizado, filtros en tiempo real por búsqueda de texto, modelo, color y talla disponible.
   - **Estado Inicial Neutro (Revisión #3):**
     * Al cargar la tarjeta o abrir la ficha de detalle, el estado inicial es neutro (`selectedColor = null`, `selectedVariantId = null`).
     * Se muestra únicamente la foto de portada principal del modelo.
     * El botón de reserva se encuentra **estrictamente deshabilitado** con mensaje orientativo: *"Selecciona color y talla para reservar"*.
     * Al elegir color, se filtran las tallas y fotos correspondientes; una vez seleccionada la talla, el botón pasa a estar 100% activo.
   - **Zoom Interactivo Profundo y Gestos Táctiles (Revisión #5 - Motor Estándar react-zoom-pan-pinch):**
     * **Aislamiento Total de Estado (`key={currentIndex}`):** Al cambiar de foto (flechas, miniaturas o swipe), el `TransformWrapper` se reinicia limpiamente a 1x (0,0), garantizando que no se arrastren offsets ni zoom residual a la siguiente fotografía.
     * **Desktop (Rueda & Panning 360°):** Zoom fluido mediante rueda del ratón (wheel hasta 5x) y arrastre sostenido (`drag & pan`) libre en todas las direcciones con visualización de escala en tiempo real.
     * **Móvil / Táctil (Pinch & Double-Tap):** Gesto de pinza nativo con 2 dedos (pinch-to-zoom continuo), doble toque (double-tap toggle) para zoom/reset rápido y arrastre suave con 1 dedo sobre imagen ampliada.
     * **Toolbar Flotante:** Controles independientes fuera del viewport de transformación para zoom in (+), zoom out (-), reset (1x), cerrar y flechas de navegación.
   - **Bolsa de Reserva & WhatsApp Directo:** Drawer de reserva donde el cliente añade pares seleccionados, ingresa su Nombre, Teléfono WhatsApp (con prefijo pre-llenado `+56 9 ` para autocompletar 8 dígitos) y Comuna/Ciudad, seleccionando modalidad (Entrega presencial en Concepción/Penco o Envío Starken Por Pagar), generando un enlace directo `https://wa.me/?text=...` hacia el número oficial configurado.
   - **Widget de Chatbot Asistente (Revisión #10):** Chatbot flotante interactivo en la esquina inferior derecha (`/`), contextualizado sobre la tienda 100% online de remate de bodega (sin tienda física para probarse, entregas presenciales en Concepción/Penco y envíos por Starken por pagar). En caso de quiebre de stock en el calzado consultado, aclara que está agotado por liquidación y ofrece 2 a 3 alternativas disponibles en la misma talla. Incluye badges cliqueables que hacen scroll y destacan el calzado en el catálogo.

2. **Ruta Privada (`/admin`):**
   - **Acceso Protegido por PIN:** Autenticación por contraseña configurada en `VITE_ADMIN_PASSWORD` (por defecto `Tiny1234` / `Gaspi.123#2026`).
   - **Módulo de Venta Multi-Producto con Precio Libre:** Venta directa/dueña formalizada bajo el nombre **"Carmen"** ($0 comisión), con campo editable de "Monto de Venta Real / Cobrado" por calzado y recálculo de comisiones en vivo.
   - **Pestaña "📋 Reservas" (Revisión #10):** Registro y trazabilidad de solicitudes de clientes de la web y chatbot, con filtros por estado (Pendiente, Completada, Cancelada) y acción de **"Convertir a Venta"** que precarga automáticamente los pares en la terminal de cobro y descuento de inventario.
   - **Pestaña "Detalle de Movimientos" (Kardex en Vivo):** Auditoría visual en tiempo real de la tabla `detalle_movimientos` con fecha de operación y registro, badges y filtros.
   - **Pestaña "⚙️ Parámetros" (Revisión #10):** Configuración persistente del teléfono WhatsApp oficial de ventas, nombre de la dueña, modalidad de la tienda, entregas locales y envíos nacionales.
   - **Módulo de Devoluciones:** Selector de variante y cantidad a reintegrar con registro de motivo.
   - **Gestor de Fotos & Galería General:** Previsualización de fotos existentes por modelo/color y zona de Drag & Drop para carga y reemplazo.
   - **Panel Analítico y Alertas:** Monitor de stock crítico (<= 2 pares o agotados) y resumen de métricas generales.