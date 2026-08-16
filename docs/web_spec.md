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
- Almacenamiento: Bucket 'productos-imagenes'

## 3. LÓGICA FINANCIERA Y DE PRECIOS
- `precio_interno`: Precio base oficial de venta directa (remate).
- `precio_vendedores`: Precio asignado al vendedor externo.
- `comision_vendedor`: Delta automático calculado al momento de la venta (`precio_vendedores` - `precio_interno`). Si el precio interno cambia (remate sobre remate), la comisión se ajusta automáticamente sobre el nuevo valor base.

## 4. MODELO DE DATOS EN SUPABASE (5 TABLAS)

### Tabla 1: `productos` (Ficha General del Modelo)
- `id` (uuid, PK, default: gen_random_uuid())
- `codigo_modelo` (text, ej: "AA0002", "EC0077")
- `nombre_fantasia` (text, ej: "Barcelona", "Turín")
- `material` (text, ej: "Cuero 100%")
- `taco_base` (text, ej: "5cm / acrilico")
- `horma` (text, ej: "Normal")
- `info_adicional` (text, ej: "Tachas decorativas")
- `imagen_defecto_url` (text, URL pública en Supabase Storage)

### Tabla 2: `inventario_variantes` (Stock por Color, Talla y Precios)
- `id` (uuid, PK, default: gen_random_uuid())
- `producto_id` (uuid, FK -> productos.id)
- `sku_variante` (text, ej: "AA0002-NEG-38")
- `color` (text, ej: "Negro", "Suela")
- `talla` (integer, ej: 35, 36, 37, 38, 39, 40)
- `stock_disponible` (integer, default: 0)
- `imagen_portada_variante` (text, URL pública de la variante específica)
- `precio_interno` (numeric, ej: 39990)
- `precio_vendedores` (numeric, ej: 39990)

### Tabla 3: `imagenes_variante` (Galería Multi-Ángulo)
- `id` (uuid, PK, default: gen_random_uuid())
- `variante_id` (uuid, FK -> inventario_variantes.id)
- `imagen_url` (text, URL pública en Supabase Storage)
- `angulo_descripcion` (text, ej: "Vista frontal", "Vista suela", "Vista lateral")
- `orden_posicion` (integer, default: 1)

### Tabla 4: `ventas` (Cabecera de Transacciones)
- `id` (uuid, PK, default: gen_random_uuid())
- `fecha_venta` (timestamp with time zone, default: now())
- `vendedor` (text, ej: "admin_stephanie", "camila")
- `medio_pago` (text, ej: "Transferencia", "Efectivo", "Débito")
- `tipo_operacion` (text, default: "Venta" / "Devolución")
- `monto_total` (numeric)

### Tabla 5: `detalle_movimientos` (Kardex e Historial de Inventario)
- `id` (uuid, PK, default: gen_random_uuid())
- `venta_id` (uuid, FK -> ventas.id, nullable)
- `variante_id` (uuid, FK -> inventario_variantes.id)
- `tipo_movimiento` (text, ej: "Salida Venta", "Entrada Devolucion", "Ingreso Proveedor", "Ajuste Merma")
- `cantidad` (integer, ej: 1)
- `precio_aplicado` (numeric)
- `comision_vendedor` (numeric, delta registrado)
- `notas` (text)

## 5. REQUERIMIENTOS DEL FRONTEND (VERCEL)
1. **Vista Pública (Catálogo):**
   - Tarjetas de catálogo ordenadas por modelo.
   - Selector visual de colores y tallas disponibles en tiempo real.
   - Al hacer clic en un producto, abre un modal con la galería de fotos multi-ángulo de la variante seleccionada.
2. **Vista Administración (Panel Privado):**
   - Módulo de simulación / registro de Ventas (descuenta stock automáticamente).
   - Módulo de registro de Devoluciones (reintegra stock).
   - Módulo de carga/gestión de imágenes para productos y variantes.