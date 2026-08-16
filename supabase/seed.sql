-- ==============================================================================
-- PROYECTO: Mantenedor de Stock de Zapatos y Registro de Movimientos
-- SEED DATA: Catálogo Inicial de Productos, Variantes, Imágenes y Movimientos
-- ==============================================================================

-- 1. INSERTAR MODELOS DE PRODUCTOS
INSERT INTO public.productos (id, codigo_modelo, nombre_fantasia, material, taco_base, horma, info_adicional, imagen_defecto_url)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'AA0002', 'Barcelona', 'Cuero 100% Genuino', '5cm / Acrílico Transparente', 'Normal', 'Tachas decorativas laterales y plantilla acolchada', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-portada.jpg'),
    ('a0000000-0000-0000-0000-000000000002', 'EC0077', 'Turín', 'Gamuzón Importado', '7cm / Madera Forrada', 'Holgada', 'Hebilla dorada al tobillo y suela antideslizante', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/EC0077-portada.jpg'),
    ('a0000000-0000-0000-0000-000000000003', 'MD0105', 'Milano', 'Cuero Charol', '3cm / Goma Liviana', 'Normal', 'Mocasín clásico con costura artesanal', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/MD0105-portada.jpg')
ON CONFLICT (codigo_modelo) DO NOTHING;

-- 2. INSERTAR VARIANTES DE INVENTARIO (Stock por Talla, Color y Precios)
-- Modelo Barcelona (AA0002)
INSERT INTO public.inventario_variantes (id, producto_id, sku_variante, color, talla, stock_disponible, stock_minimo_alerta, precio_interno, precio_vendedores, imagen_portada_variante)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'AA0002-NEG-36', 'Negro', 36, 5, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG.jpg'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'AA0002-NEG-37', 'Negro', 37, 8, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG.jpg'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'AA0002-NEG-38', 'Negro', 38, 4, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG.jpg'),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'AA0002-SUE-36', 'Suela', 36, 3, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-SUE.jpg'),
    ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'AA0002-SUE-37', 'Suela', 37, 6, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-SUE.jpg'),
    ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'AA0002-SUE-38', 'Suela', 38, 1, 2, 28990, 39990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-SUE.jpg')
ON CONFLICT (sku_variante) DO NOTHING;

-- Modelo Turín (EC0077)
INSERT INTO public.inventario_variantes (id, producto_id, sku_variante, color, talla, stock_disponible, stock_minimo_alerta, precio_interno, precio_vendedores, imagen_portada_variante)
VALUES 
    ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'EC0077-NUD-36', 'Nude', 36, 4, 2, 32990, 44990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/EC0077-NUD.jpg'),
    ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'EC0077-NUD-37', 'Nude', 37, 7, 2, 32990, 44990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/EC0077-NUD.jpg'),
    ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'EC0077-NEG-37', 'Negro', 37, 2, 2, 32990, 44990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/EC0077-NEG.jpg'),
    ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000002', 'EC0077-NEG-38', 'Negro', 38, 0, 2, 32990, 44990, 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/EC0077-NEG.jpg')
ON CONFLICT (sku_variante) DO NOTHING;

-- 3. INSERTAR GALERÍA MULTI-ÁNGULO PARA VARIANTES
INSERT INTO public.imagenes_variante (variante_id, imagen_url, angulo_descripcion, orden_posicion)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG-frontal.jpg', 'Vista Frontal', 1),
    ('b0000000-0000-0000-0000-000000000001', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG-lateral.jpg', 'Vista Lateral Exterior', 2),
    ('b0000000-0000-0000-0000-000000000001', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-NEG-suela.jpg', 'Detalle Suela y Taco', 3),
    ('b0000000-0000-0000-0000-000000000004', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-SUE-frontal.jpg', 'Vista Frontal Suela', 1),
    ('b0000000-0000-0000-0000-000000000004', 'https://leifskqgupgsajgemgul.supabase.co/storage/v1/object/public/productos/AA0002-SUE-lateral.jpg', 'Vista Lateral Suela', 2);

-- 4. INSERTAR TRANSACCIÓN Y MOVIMIENTO INICIAL DE PRUEBA
INSERT INTO public.ventas (id, fecha_venta, vendedor, medio_pago, tipo_operacion, monto_total, notas)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', now() - interval '2 hours', 'admin_stephanie', 'Transferencia', 'Venta', 39990, 'Venta inicial showroom');

INSERT INTO public.detalle_movimientos (venta_id, variante_id, tipo_movimiento, cantidad, precio_aplicado, comision_vendedor, notas)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Salida Venta', 1, 39990, 11000, 'Par talla 37 Negro entregado');
