# WEB_SPEC.MD - ESPECIFICACIÓN TÉCNICA DEL PROYECTO

## 1. INFORMACIÓN DEL PROYECTO
- **Nombre:** Mantenedor de Stock de Zapatos y Registro de Movimientos (Ejercicio 3)
- **Repositorio GitHub:** https://github.com/cristobalsssss/4-stock-zapatos.git
- **Estrategia:** Vibe Coding + AI Skills (n8n) + Backend (Supabase) + Frontend (Vercel)

## 2. ARQUITECTURA DEL SISTEMA
\[ FRONTEND (Vercel) \] <---> \[ SKILLS ENGINE (n8n en Render) \] <---> \[ DATABASE & STORAGE (Supabase) \]

- Catálogo Público: Consultar Stock
- Panel Admin Movimientos: Registrar Venta/Devolución
- Base de Datos: 5 Tablas Relacionales
- Almacenamiento: Buckets públicos 'productos' y 'productos-imagenes' en Supabase Storage

## 3. LÓGICA FINANCIERA Y DE PRECIOS
- `precio_interno`: Precio base oficial de venta directa (remate).
- `precio_vendedores`: Precio asignado al vendedor externo.
- `comision_vendedor`: Delta automático calculado al momento de la venta (`precio_vendedores` - `precio_interno`). Si el precio interno cambia (remate sobre remate), la comisión se ajusta automáticamente sobre el nuevo valor base.

## 4. MODELO DE DATOS EN SUPABASE (5 TABLAS BASE)

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

## 5. FUNCIONALIDADES PROACTIVAS AÑADIDAS POR LA IA

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

## 6. CARGA Y MIGRACIÓN DE DATOS REALES (ETL)
- **Origen de datos:** `data/inventario_real.xlsx`
- **Mecanismo:** Script Node.js con herencia de celdas combinadas (*Forward Fill*).
- **Resultados de Producción:**
  - `productos`: 84 registros únicos por código de modelo.
  - `inventario_variantes`: 714 variantes (combinación modelo + color + talla).
  - Unidades con stock disponible en bodega: 253 pares distribuidos en 173 variantes activas.

## 7. REQUERIMIENTOS DEL FRONTEND (VERCEL)
1. **Vista Pública (Catálogo):**
   - Tarjetas de catálogo ordenadas por modelo.
   - Selector visual de colores y tallas disponibles en tiempo real.
   - Al hacer clic en un producto, abre un modal con la galería de fotos multi-ángulo de la variante seleccionada.
2. **Vista Administración (Panel Privado):**
   - Módulo de simulación / registro de Ventas (descuenta stock automáticamente).
   - Módulo de registro de Devoluciones (reintegra stock).
   - Módulo de carga/gestión de imágenes para productos y variantes.
   - Panel de Alertas de Stock Crítico y Resumen de Comisiones.