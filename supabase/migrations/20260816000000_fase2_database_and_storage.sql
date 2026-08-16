-- Migration: 20260816000000_fase2_database_and_storage.sql
-- Description: Creación de tablas base (5), tablas proactivas, triggers de kardex/precios, vistas analíticas y políticas RLS/Storage

-- 0. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLAS BASE
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_modelo TEXT NOT NULL UNIQUE,
    nombre_fantasia TEXT NOT NULL,
    material TEXT,
    taco_base TEXT,
    horma TEXT DEFAULT 'Normal',
    info_adicional TEXT,
    imagen_defecto_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventario_variantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    sku_variante TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    talla INTEGER NOT NULL,
    stock_disponible INTEGER NOT NULL DEFAULT 0 CHECK (stock_disponible >= 0),
    stock_minimo_alerta INTEGER NOT NULL DEFAULT 2 CHECK (stock_minimo_alerta >= 0),
    imagen_portada_variante TEXT,
    precio_interno NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_interno >= 0),
    precio_vendedores NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_vendedores >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_producto_color_talla UNIQUE (producto_id, color, talla)
);

CREATE TABLE IF NOT EXISTS public.imagenes_variante (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variante_id UUID NOT NULL REFERENCES public.inventario_variantes(id) ON DELETE CASCADE,
    imagen_url TEXT NOT NULL,
    angulo_descripcion TEXT DEFAULT 'Vista frontal',
    orden_posicion INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_venta TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    vendedor TEXT NOT NULL DEFAULT 'admin_general',
    medio_pago TEXT NOT NULL DEFAULT 'Transferencia',
    tipo_operacion TEXT NOT NULL DEFAULT 'Venta',
    monto_total NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monto_total >= 0),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.detalle_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID REFERENCES public.ventas(id) ON DELETE SET NULL,
    variante_id UUID NOT NULL REFERENCES public.inventario_variantes(id) ON DELETE RESTRICT,
    tipo_movimiento TEXT NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_aplicado NUMERIC(12, 2) NOT NULL DEFAULT 0,
    comision_vendedor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLAS PROACTIVAS
CREATE TABLE IF NOT EXISTS public.historial_precios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variante_id UUID NOT NULL REFERENCES public.inventario_variantes(id) ON DELETE CASCADE,
    precio_interno_anterior NUMERIC(12, 2),
    precio_interno_nuevo NUMERIC(12, 2) NOT NULL,
    precio_vendedores_anterior NUMERIC(12, 2),
    precio_vendedores_nuevo NUMERIC(12, 2) NOT NULL,
    motivo_cambio TEXT DEFAULT 'Actualización de tarifa / liquidación',
    usuario_responsable TEXT DEFAULT 'sistema',
    fecha_cambio TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.log_busquedas_vistas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
    termino_busqueda TEXT,
    talla_consultada INTEGER,
    color_consultado TEXT,
    con_stock BOOLEAN DEFAULT true,
    ip_origen TEXT,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_productos_codigo_modelo ON public.productos(codigo_modelo);
CREATE INDEX IF NOT EXISTS idx_inventario_producto_id ON public.inventario_variantes(producto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_sku ON public.inventario_variantes(sku_variante);
CREATE INDEX IF NOT EXISTS idx_inventario_color ON public.inventario_variantes(color);
CREATE INDEX IF NOT EXISTS idx_inventario_talla ON public.inventario_variantes(talla);
CREATE INDEX IF NOT EXISTS idx_imagenes_variante_id ON public.imagenes_variante(variante_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON public.ventas(fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_variante ON public.detalle_movimientos(variante_id);

-- 4. TRIGGERS
CREATE OR REPLACE FUNCTION public.fn_actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_updated_at ON public.productos;
CREATE TRIGGER trg_productos_updated_at
    BEFORE UPDATE ON public.productos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_actualizar_updated_at();

DROP TRIGGER IF EXISTS trg_inventario_updated_at ON public.inventario_variantes;
CREATE TRIGGER trg_inventario_updated_at
    BEFORE UPDATE ON public.inventario_variantes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_actualizar_updated_at();

CREATE OR REPLACE FUNCTION public.fn_auditar_cambio_precio()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.precio_interno IS DISTINCT FROM NEW.precio_interno) OR 
       (OLD.precio_vendedores IS DISTINCT FROM NEW.precio_vendedores) THEN
        INSERT INTO public.historial_precios (
            variante_id,
            precio_interno_anterior,
            precio_interno_nuevo,
            precio_vendedores_anterior,
            precio_vendedores_nuevo,
            motivo_cambio,
            usuario_responsable
        ) VALUES (
            NEW.id,
            OLD.precio_interno,
            NEW.precio_interno,
            OLD.precio_vendedores,
            NEW.precio_vendedores,
            'Modificación de precio en mantenedor',
            COALESCE(current_setting('app.current_user', true), 'admin')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditar_precio ON public.inventario_variantes;
CREATE TRIGGER trg_auditar_precio
    AFTER UPDATE ON public.inventario_variantes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_auditar_cambio_precio();

CREATE OR REPLACE FUNCTION public.fn_procesar_movimiento_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_actual INTEGER;
    v_precio_interno NUMERIC(12, 2);
    v_precio_vendedores NUMERIC(12, 2);
BEGIN
    SELECT stock_disponible, precio_interno, precio_vendedores
    INTO v_stock_actual, v_precio_interno, v_precio_vendedores
    FROM public.inventario_variantes
    WHERE id = NEW.variante_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Variante con ID % no existe.', NEW.variante_id;
    END IF;

    IF NEW.precio_aplicado IS NULL OR NEW.precio_aplicado = 0 THEN
        NEW.precio_aplicado := v_precio_vendedores;
    END IF;

    IF NEW.comision_vendedor IS NULL OR NEW.comision_vendedor = 0 THEN
        NEW.comision_vendedor := GREATEST(0, (NEW.precio_aplicado - v_precio_interno) * NEW.cantidad);
    END IF;

    IF NEW.tipo_movimiento IN ('Salida Venta', 'Ajuste Merma') THEN
        IF v_stock_actual < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_stock_actual, NEW.cantidad;
        END IF;

        UPDATE public.inventario_variantes
        SET stock_disponible = stock_disponible - NEW.cantidad
        WHERE id = NEW.variante_id;

    ELSIF NEW.tipo_movimiento IN ('Entrada Devolucion', 'Ingreso Proveedor', 'Ajuste Entrada') THEN
        UPDATE public.inventario_variantes
        SET stock_disponible = stock_disponible + NEW.cantidad
        WHERE id = NEW.variante_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_procesar_movimiento_stock ON public.detalle_movimientos;
CREATE TRIGGER trg_procesar_movimiento_stock
    BEFORE INSERT ON public.detalle_movimientos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_procesar_movimiento_stock();

-- 5. VISTAS
CREATE OR REPLACE VIEW public.v_catalogo_resumen AS
SELECT 
    p.id AS producto_id,
    p.codigo_modelo,
    p.nombre_fantasia,
    p.material,
    p.taco_base,
    p.horma,
    p.info_adicional,
    p.imagen_defecto_url,
    COALESCE(SUM(iv.stock_disponible), 0) AS stock_total,
    COALESCE(MIN(iv.precio_interno), 0) AS precio_interno_min,
    COALESCE(MIN(iv.precio_vendedores), 0) AS precio_vendedores_min,
    COALESCE(MAX(iv.precio_vendedores), 0) AS precio_vendedores_max,
    json_agg(
        DISTINCT jsonb_build_object(
            'color', iv.color,
            'imagen_portada', iv.imagen_portada_variante
        )
    ) FILTER (WHERE iv.id IS NOT NULL) AS colores,
    json_agg(
        DISTINCT iv.talla
    ) FILTER (WHERE iv.id IS NOT NULL) AS tallas_disponibles,
    COUNT(iv.id) AS total_variantes
FROM public.productos p
LEFT JOIN public.inventario_variantes iv ON p.id = iv.producto_id
GROUP BY p.id, p.codigo_modelo, p.nombre_fantasia, p.material, p.taco_base, p.horma, p.info_adicional, p.imagen_defecto_url;

CREATE OR REPLACE VIEW public.v_alertas_stock_critico AS
SELECT 
    iv.id AS variante_id,
    p.codigo_modelo,
    p.nombre_fantasia,
    iv.sku_variante,
    iv.color,
    iv.talla,
    iv.stock_disponible,
    iv.stock_minimo_alerta,
    CASE 
        WHEN iv.stock_disponible = 0 THEN 'AGOTADO'
        WHEN iv.stock_disponible <= iv.stock_minimo_alerta THEN 'CRITICO'
        ELSE 'NORMAL'
    END AS estado_stock,
    iv.precio_vendedores
FROM public.inventario_variantes iv
JOIN public.productos p ON iv.producto_id = p.id
WHERE iv.stock_disponible <= iv.stock_minimo_alerta
ORDER BY iv.stock_disponible ASC, p.codigo_modelo ASC;

CREATE OR REPLACE VIEW public.v_resumen_vendedores AS
SELECT 
    v.vendedor,
    COUNT(DISTINCT v.id) AS total_operaciones,
    COALESCE(SUM(CASE WHEN v.tipo_operacion = 'Venta' THEN v.monto_total ELSE -v.monto_total END), 0) AS volumen_ventas_neto,
    COALESCE(SUM(dm.comision_vendedor), 0) AS total_comisiones_generadas,
    COALESCE(SUM(CASE WHEN dm.tipo_movimiento = 'Salida Venta' THEN dm.cantidad ELSE 0 END), 0) AS pares_vendidos,
    COALESCE(SUM(CASE WHEN dm.tipo_movimiento = 'Entrada Devolucion' THEN dm.cantidad ELSE 0 END), 0) AS pares_devueltos
FROM public.ventas v
LEFT JOIN public.detalle_movimientos dm ON v.id = dm.venta_id
GROUP BY v.vendedor;

-- 6. RLS
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_busquedas_vistas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de productos" ON public.productos FOR SELECT USING (true);
CREATE POLICY "Lectura pública de inventario" ON public.inventario_variantes FOR SELECT USING (true);
CREATE POLICY "Lectura pública de imagenes" ON public.imagenes_variante FOR SELECT USING (true);
CREATE POLICY "Lectura pública de ventas" ON public.ventas FOR SELECT USING (true);
CREATE POLICY "Lectura pública de detalle_movimientos" ON public.detalle_movimientos FOR SELECT USING (true);
CREATE POLICY "Lectura pública de historial_precios" ON public.historial_precios FOR SELECT USING (true);

CREATE POLICY "Permitir insercion/edicion productos" ON public.productos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insercion/edicion inventario" ON public.inventario_variantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insercion/edicion imagenes" ON public.imagenes_variante FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insercion ventas" ON public.ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insercion detalle_movimientos" ON public.detalle_movimientos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir insercion log" ON public.log_busquedas_vistas FOR ALL USING (true) WITH CHECK (true);
