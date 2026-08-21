import { supabase, BUCKET_NAME } from './supabase';

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://n8n-backend-finanzas.onrender.com';

/**
 * Consulta el catálogo de productos con variantes y stock disponible
 */
export async function getCatalogFromSupabase() {
  try {
    const { data: productos, error: prodError } = await supabase
      .from('productos')
      .select(`
        id,
        codigo_modelo,
        nombre_fantasia,
        categoria,
        material,
        taco_base,
        horma,
        info_adicional,
        imagen_defecto_url,
        inventario_variantes (
          id,
          sku_variante,
          color,
          talla,
          stock_disponible,
          stock_minimo_alerta,
          imagen_portada_variante,
          precio_interno,
          precio_vendedores,
          imagenes_variante (
            id,
            imagen_url,
            angulo_descripcion,
            orden_posicion
          )
        )
      `)
      .order('codigo_modelo', { ascending: true });

    if (prodError) throw prodError;
    return productos || [];
  } catch (err) {
    console.error('Error al obtener catálogo desde Supabase:', err);
    throw err;
  }
}

/**
 * Consulta de stock vía n8n Skill 1
 */
export async function consultarStockN8N(filtros = {}) {
  try {
    const res = await fetch(`${N8N_URL}/webhook/consultar-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filtros),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Fallback a Supabase directo por fallo en n8n Skill 1:', err);
    return null;
  }
}

/**
 * Registra una venta vía n8n Skill 2 con fallback directo a Supabase
 */
export async function registrarVenta({ variante_id, cantidad, vendedor, medio_pago, precio_aplicado, comision_vendedor, notas, fecha_venta }) {
  try {
    const res = await fetch(`${N8N_URL}/webhook/registrar-venta`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        variante_id,
        cantidad,
        vendedor,
        medio_pago,
        precio_aplicado,
        comision_vendedor,
        notas,
        fecha_venta
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.warn('Fallo n8n Skill 2, procesando directamente en Supabase:', err);
  }

  // Fallback transaccional directo a Supabase
  const { data: variante, error: vErr } = await supabase
    .from('inventario_variantes')
    .select('*')
    .eq('id', variante_id)
    .single();

  if (vErr || !variante) throw new Error('Variante no encontrada');
  if (variante.stock_disponible < cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${variante.stock_disponible}`);
  }

  const precioFinal = precio_aplicado || Number(variante.precio_vendedores);
  const precioInterno = Number(variante.precio_interno) || 0;
  const isInterna = (vendedor || '').toLowerCase().includes('interna') || (vendedor || '').toLowerCase().includes('admin') || (vendedor || '').toLowerCase().includes('dueñ');
  const comisionFinal = comision_vendedor !== undefined && comision_vendedor !== null
    ? comision_vendedor
    : (isInterna ? 0 : Math.max(0, (precioFinal - precioInterno) * cantidad));

  const montoTotal = precioFinal * cantidad;

  // Insertar Venta
  const { data: venta, error: ventaErr } = await supabase
    .from('ventas')
    .insert({
      vendedor: vendedor || 'Camila',
      medio_pago: medio_pago || 'Transferencia',
      tipo_operacion: 'Venta',
      monto_total: montoTotal,
      notas: notas || 'Venta desde Frontend',
      fecha_venta: fecha_venta || new Date().toISOString()
    })
    .select()
    .single();

  if (ventaErr) throw ventaErr;

  // Descontar Stock
  const nuevoStock = variante.stock_disponible - cantidad;
  const { error: stockErr } = await supabase
    .from('inventario_variantes')
    .update({ stock_disponible: nuevoStock, updated_at: new Date().toISOString() })
    .eq('id', variante_id);

  if (stockErr) throw stockErr;

  // Registrar Movimiento Kardex
  const { error: movErr } = await supabase
    .from('detalle_movimientos')
    .insert({
      venta_id: venta.id,
      variante_id: variante_id,
      tipo_movimiento: 'Venta',
      cantidad: cantidad,
      precio_aplicado: precioFinal,
      comision_vendedor: comisionFinal,
      notas: notas || `Venta (${vendedor || 'Camila'})`
    });

  if (movErr) console.warn('Error al registrar detalle movimiento:', movErr);

  try {
    window.dispatchEvent(new Event('movimientos_updated'));
  } catch (e) {}

  return {
    success: true,
    venta_id: venta.id,
    variante_id,
    stock_restante: nuevoStock,
    monto_total: montoTotal,
    comision_vendedor: comisionFinal
  };
}

/**
 * Registra una devolución vía n8n Skill 3 con fallback directo a Supabase
 */
export async function registrarDevolucion({ variante_id, cantidad, motivo, venta_id }) {
  try {
    const res = await fetch(`${N8N_URL}/webhook/registrar-devolucion`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({ variante_id, cantidad, motivo, venta_id }),
    });

    if (res.ok) {
      const data = await res.json();
      try {
        window.dispatchEvent(new Event('movimientos_updated'));
      } catch (e) {}
      return data;
    }
  } catch (err) {
    console.warn('Fallo n8n Skill 3, procesando en Supabase:', err);
  }

  // Fallback Supabase
  const { data: variante, error: vErr } = await supabase
    .from('inventario_variantes')
    .select('*')
    .eq('id', variante_id)
    .single();

  if (vErr || !variante) throw new Error('Variante no encontrada');

  const nuevoStock = Number(variante.stock_disponible) + Number(cantidad);

  await supabase
    .from('inventario_variantes')
    .update({ stock_disponible: nuevoStock, updated_at: new Date().toISOString() })
    .eq('id', variante_id);

  await supabase
    .from('detalle_movimientos')
    .insert({
      venta_id: venta_id || null,
      variante_id: variante_id,
      tipo_movimiento: 'Devolucion',
      cantidad: Number(cantidad),
      precio_aplicado: Number(variante.precio_vendedores) || 0,
      comision_vendedor: 0,
      notas: motivo || 'Devolución de cliente'
    });

  try {
    window.dispatchEvent(new Event('movimientos_updated'));
  } catch (e) {}

  return {
    success: true,
    variante_id,
    stock_disponible: nuevoStock,
    cantidad_reintegrada: cantidad
  };
}

/**
 * Sube una imagen a Supabase Storage
 */
export async function subirImagenStorage(file, folder = 'modelos') {
  const ext = file.name.split('.').pop();
  const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  const fileName = `${folder}/${Date.now()}_${cleanName}.${ext}`;

  const { data, error } = await supabase.storage
    .from('productos-imagenes')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    const { data: fallbackData, error: fbError } = await supabase.storage
      .from('productos-imagenes')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (fbError) throw fbError;
    const { data: publicUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  }

  const { data: publicUrlData } = supabase.storage.from('productos-imagenes').getPublicUrl(fileName);
  return publicUrlData.publicUrl;
}

export async function actualizarImagenModelo(productoId, url) {
  const { error } = await supabase
    .from('productos')
    .update({ imagen_defecto_url: url, updated_at: new Date().toISOString() })
    .eq('id', productoId);
  if (error) throw error;
}

export async function eliminarImagenModelo(productoId) {
  const { error } = await supabase
    .from('productos')
    .update({ imagen_defecto_url: null, updated_at: new Date().toISOString() })
    .eq('id', productoId);
  if (error) throw error;
}

export async function actualizarImagenColor(productoId, color, url) {
  const { error } = await supabase
    .from('inventario_variantes')
    .update({ imagen_portada_variante: url, updated_at: new Date().toISOString() })
    .eq('producto_id', productoId)
    .eq('color', color);
  if (error) throw error;
}

export async function eliminarImagenColor(productoId, color) {
  const { error } = await supabase
    .from('inventario_variantes')
    .update({ imagen_portada_variante: null, updated_at: new Date().toISOString() })
    .eq('producto_id', productoId)
    .eq('color', color);
  if (error) throw error;
}

export async function agregarImagenGaleriaColor(productoId, color, url) {
  const { data: variante, error: vErr } = await supabase
    .from('inventario_variantes')
    .select('id')
    .eq('producto_id', productoId)
    .eq('color', color)
    .limit(1)
    .single();

  if (vErr || !variante) {
    const { data: vFallback } = await supabase
      .from('inventario_variantes')
      .select('id')
      .eq('producto_id', productoId)
      .limit(1)
      .single();

    if (!vFallback) throw new Error('No se encontró variante para asociar la imagen');
    
    const { error } = await supabase
      .from('imagenes_variante')
      .insert({
        variante_id: vFallback.id,
        imagen_url: url,
        angulo_descripcion: 'Galería General',
        orden_posicion: 1
      });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('imagenes_variante')
    .insert({
      variante_id: variante.id,
      imagen_url: url,
      angulo_descripcion: 'Galería General',
      orden_posicion: 1
    });
  if (error) throw error;
}

export async function eliminarImagenGaleria(imagenId) {
  const { error } = await supabase
    .from('imagenes_variante')
    .delete()
    .eq('id', imagenId);
  if (error) throw error;
}

/**
 * Consulta el historial de movimientos de inventario (Kardex)
 */
export async function getDetalleMovimientos() {
  try {
    const { data, error } = await supabase
      .from('detalle_movimientos')
      .select(`
        id,
        tipo_movimiento,
        cantidad,
        precio_aplicado,
        comision_vendedor,
        notas,
        created_at,
        venta_id,
        ventas (
          id,
          vendedor,
          medio_pago,
          fecha_venta,
          monto_total,
          notas
        ),
        inventario_variantes (
          id,
          sku_variante,
          color,
          talla,
          precio_vendedores,
          precio_interno,
          productos (
            id,
            codigo_modelo,
            nombre_fantasia,
            material
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error al obtener detalle de movimientos:', err);
    throw err;
  }
}

/**
 * =========================================================================
 * ⚙️ CONFIGURACIÓN DINÁMICA DE LA TIENDA Y PARÁMETROS DE CONTACTO
 * =========================================================================
 */
const DEFAULT_CONFIG = {
  telefono_whatsapp: '+56900000000',
  nombre_vendedora: 'Carmen',
  modalidad_tienda: 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
  entregas_locales: 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
  envios_nacionales: 'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
};

const CONFIG_STORAGE_KEY = 'stock_zapatos_config';

export async function getConfiguracion() {
  try {
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      const merged = { ...DEFAULT_CONFIG, ...data };
      try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}
      return merged;
    }
  } catch (err) {}

  try {
    const local = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (local) return { ...DEFAULT_CONFIG, ...JSON.parse(local) };
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CONFIG;
}

export async function guardarConfiguracion(nuevaConfig) {
  const configCompleta = { ...DEFAULT_CONFIG, ...nuevaConfig };

  try {
    await supabase
      .from('configuracion')
      .upsert({
        id: 1,
        telefono_whatsapp: configCompleta.telefono_whatsapp,
        nombre_vendedora: configCompleta.nombre_vendedora || configCompleta.nombre_duena || 'Carmen',
        modalidad_tienda: configCompleta.modalidad_tienda,
        entregas_locales: configCompleta.entregas_locales,
        envios_nacionales: configCompleta.envios_nacionales,
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn('Fallback local para configuracion:', err);
  }

  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configCompleta));
    window.dispatchEvent(new CustomEvent('config_updated', { detail: configCompleta }));
  } catch (e) {
    console.error('Error al guardar configuración local:', e);
  }

  return configCompleta;
}

/**
 * =========================================================================
 * 📋 GESTIÓN Y PERSISTENCIA DE RESERVAS CON CÓDIGO ÚNICO #RES-XXXX
 * =========================================================================
 */
const RESERVAS_STORAGE_KEY = 'stock_zapatos_reservas';

export async function getReservas() {
  const reservasMap = new Map();

  // 1. Cargar desde Supabase (Fuente de verdad canónica)
  try {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      data.forEach(r => {
        const key = r.codigo_reserva || r.id;
        reservasMap.set(key, r);
      });
    }
  } catch (err) {
    console.warn('Consulta tabla reservas fallback local:', err);
  }

  // 2. Cargar desde localStorage solo las que no existan en Supabase (ej: offline o recién creadas)
  try {
    const localStr = localStorage.getItem(RESERVAS_STORAGE_KEY);
    if (localStr) {
      const localList = JSON.parse(localStr);
      if (Array.isArray(localList)) {
        localList.forEach(r => {
          const key = r.codigo_reserva || r.id;
          if (!reservasMap.has(key)) {
            reservasMap.set(key, r);
          }
        });
      }
    }
  } catch (e) {
    console.error('Error leyendo reservas locales:', e);
  }

  const result = Array.from(reservasMap.values()).sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );

  // Sincronizar localStorage con la lista limpia y deduplicada
  try {
    localStorage.setItem(RESERVAS_STORAGE_KEY, JSON.stringify(result));
  } catch (e) {}

  return result;
}

/**
 * Crea una reserva conectando a n8n Skill 4 con fallback directo a Supabase
 */
export async function crearReserva({
  codigo_reserva,
  cliente_nombre,
  cliente_whatsapp,
  cliente_comuna,
  tipo_entrega = 'Presencial Concepción/Penco',
  variante_id = null,
  modelo_codigo = '',
  modelo_nombre = '',
  color = '',
  talla = '',
  cantidad = 1,
  precio_unitario = 0,
  notas = '',
  items = []
}) {
  const codigoGenerado = codigo_reserva || `RES-${Math.floor(1000 + Math.random() * 9000)}`;
  const primerItem = (Array.isArray(items) && items.length > 0) ? items[0] : {};
  const varId = variante_id || primerItem.variante_id || primerItem.id || null;
  const modCod = (modelo_codigo && modelo_codigo !== 'N/A') ? modelo_codigo : (primerItem.codigo_modelo || primerItem.codigo || primerItem.modelo_codigo || '');
  const modNom = modelo_nombre || primerItem.nombre_fantasia || primerItem.nombre || primerItem.modelo_nombre || '';
  const col = color || primerItem.color || '';
  const tal = talla ? String(talla) : String(primerItem.talla || '');
  const cant = Number(cantidad || primerItem.cantidad || primerItem.quantity || (Array.isArray(items) && items.length > 0 ? items.reduce((acc, i) => acc + Number(i.cantidad || i.quantity || 1), 0) : 1));
  const prec = Number(precio_unitario || primerItem.precio_vendedores || primerItem.precio || primerItem.precio_sugerido || primerItem.precio_unitario || 0);

  const reservaPayload = {
    codigo_reserva: codigoGenerado,
    cliente_nombre: cliente_nombre?.trim() || 'Cliente Web',
    cliente_whatsapp: cliente_whatsapp?.trim() || '',
    cliente_comuna: cliente_comuna?.trim() || 'Concepción',
    tipo_entrega: tipo_entrega?.trim() || 'Presencial Concepción/Penco',
    variante_id: varId,
    modelo_codigo: modCod,
    modelo_nombre: modNom,
    color: col,
    talla: tal,
    cantidad: cant,
    precio_unitario: prec,
    notas: notas?.trim() || '',
    items: (Array.isArray(items) ? items : []).map(i => ({
      variante_id: i.variante_id || i.id || '',
      codigo_modelo: i.codigo_modelo || i.codigo || i.modelo_codigo || '',
      nombre_fantasia: i.nombre_fantasia || i.nombre || i.modelo_nombre || '',
      color: i.color || '',
      talla: i.talla ? String(i.talla) : '',
      cantidad: Number(i.cantidad || i.quantity || 1),
      precio: Number(i.precio_vendedores || i.precio || i.precio_sugerido || i.precio_unitario || 0)
    }))
  };

  let nuevaReserva = {
    id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    ...reservaPayload,
    total: Number(reservaPayload.precio_unitario * (reservaPayload.cantidad || 1)) || (Array.isArray(items) ? items.reduce((acc, i) => acc + (Number(i.precio || 0) * Number(i.cantidad || i.quantity || 1)), 0) : 0),
    estado: 'Pendiente',
    created_at: new Date().toISOString()
  };

  // 1. Intentar registrar vía n8n Skill 4 (Webhook: /webhook/crear-reserva)
  try {
    const res = await fetch(`${N8N_URL}/webhook/crear-reserva`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify(reservaPayload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.codigo_reserva) {
        nuevaReserva.codigo_reserva = data.codigo_reserva;
      }
      if (data && data.reserva_id) {
        nuevaReserva.id = data.reserva_id;
      }
    } else {
      throw new Error(`HTTP Error ${res.status}`);
    }
  } catch (err) {
    console.warn('Fallo n8n Skill 4 (Crear Reserva), procesando fallback directo en Supabase:', err);

    // Fallback directo a Supabase
    try {
      const { data, error } = await supabase
        .from('reservas')
        .insert({
          codigo_reserva: nuevaReserva.codigo_reserva,
          cliente_nombre: nuevaReserva.cliente_nombre,
          cliente_whatsapp: nuevaReserva.cliente_whatsapp,
          cliente_comuna: nuevaReserva.cliente_comuna,
          tipo_entrega: nuevaReserva.tipo_entrega,
          variante_id: nuevaReserva.variante_id,
          modelo_codigo: nuevaReserva.modelo_codigo,
          modelo_nombre: nuevaReserva.modelo_nombre,
          color: nuevaReserva.color,
          talla: nuevaReserva.talla,
          cantidad: nuevaReserva.cantidad,
          precio_unitario: nuevaReserva.precio_unitario,
          notas: nuevaReserva.notas,
          items: nuevaReserva.items,
          estado: 'Pendiente'
        })
        .select()
        .single();

      if (!error && data) {
        nuevaReserva.id = data.id;
      } else if (error) {
        console.error('Error insertando reserva en Supabase:', error);
      }
    } catch (dbErr) {
      console.error('Excepción guardando reserva en Supabase:', dbErr);
    }
  }

  // 2. Sincronizar en almacenamiento local deduplicado
  try {
    const prev = await getReservas();
    const actualizadas = [nuevaReserva, ...prev.filter(r => r.codigo_reserva !== nuevaReserva.codigo_reserva && r.id !== nuevaReserva.id)];
    localStorage.setItem(RESERVAS_STORAGE_KEY, JSON.stringify(actualizadas));
    window.dispatchEvent(new Event('reservas_updated'));
  } catch (e) {
    console.error('Error guardando reserva en localStorage:', e);
  }

  return nuevaReserva;
}

export const guardarReserva = crearReserva;

/**
 * Cancela una reserva conectando a n8n Skill 5 con fallback directo a Supabase
 */
export async function cancelarReserva(reservaId, motivo = 'Cancelada por Administrador') {
  // 1. Intentar cancelar vía n8n Skill 5 (Webhook: /webhook/cancelar-reserva)
  try {
    const res = await fetch(`${N8N_URL}/webhook/cancelar-reserva`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: JSON.stringify({
        id: reservaId,
        reserva_id: reservaId,
        motivo: motivo,
        estado: 'Cancelada'
      }),
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
  } catch (err) {
    console.warn('Fallo n8n Skill 5 (Cancelar Reserva), aplicando fallback en Supabase:', err);

    // Fallback directo a Supabase
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservaId);
      let query = supabase.from('reservas').update({ estado: 'Cancelada', notas: motivo, updated_at: new Date().toISOString() });
      if (isUuid) {
        query = query.eq('id', reservaId);
      } else {
        query = query.or(`id.eq.${reservaId},codigo_reserva.eq.${reservaId}`);
      }
      await query;
    } catch (dbErr) {
      console.error('Error actualizando estado en Supabase:', dbErr);
    }
  }

  // 2. Sincronizar en localStorage y notificar reactivamente a la UI
  try {
    const list = await getReservas();
    const actualizadas = list.map(r => (r.id === reservaId || r.codigo_reserva === reservaId) ? { ...r, estado: 'Cancelada', notas: motivo } : r);
    localStorage.setItem(RESERVAS_STORAGE_KEY, JSON.stringify(actualizadas));
    window.dispatchEvent(new Event('reservas_updated'));
    return actualizadas;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export async function actualizarEstadoReserva(reservaId, nuevoEstado, motivo = '') {
  if (nuevoEstado === 'Cancelada') {
    return await cancelarReserva(reservaId, motivo || 'Cancelada por Administrador');
  }

  // Actualizar en Supabase
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reservaId);
    const updateData = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    if (motivo) updateData.notas = motivo;

    let query = supabase.from('reservas').update(updateData);
    if (isUuid) {
      query = query.eq('id', reservaId);
    } else {
      query = query.or(`id.eq.${reservaId},codigo_reserva.eq.${reservaId}`);
    }
    await query;
  } catch (err) {
    console.warn('Fallo actualización Supabase reserva:', err);
  }

  // Actualizar en localStorage
  try {
    const list = await getReservas();
    const actualizadas = list.map(r => (r.id === reservaId || r.codigo_reserva === reservaId) ? { ...r, estado: nuevoEstado, ...(motivo ? { notas: motivo } : {}) } : r);
    localStorage.setItem(RESERVAS_STORAGE_KEY, JSON.stringify(actualizadas));
    window.dispatchEvent(new Event('reservas_updated'));
    return actualizadas;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

/**
 * Purga de datos transaccionales de prueba (detalle_movimientos, ventas, reservas)
 * NO toca productos, inventario_variantes ni configuracion.
 */
export async function purgarDatosPruebaFrontend() {
  const errores = [];

  // 1. Limpiar detalle_movimientos en Supabase
  try {
    const { error: errDet } = await supabase.from('detalle_movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errDet) console.warn('Aviso limpiando detalle_movimientos:', errDet);
  } catch (e) {
    errores.push(e.message);
  }

  // 2. Limpiar ventas en Supabase
  try {
    const { error: errVen } = await supabase.from('ventas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errVen) console.warn('Aviso limpiando ventas:', errVen);
  } catch (e) {
    errores.push(e.message);
  }

  // 3. Limpiar reservas en Supabase
  try {
    const { error: errRes } = await supabase.from('reservas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errRes) console.warn('Aviso limpiando reservas:', errRes);
  } catch (e) {
    errores.push(e.message);
  }

  // 4. Limpiar almacenamiento local
  try {
    localStorage.removeItem(RESERVAS_STORAGE_KEY);
    localStorage.removeItem('stock_zapatos_sales');
    localStorage.removeItem('stock_zapatos_kardex');
    localStorage.removeItem('boutique_bag_items');
  } catch (e) {
    console.error(e);
  }

  // 5. Notificar a componentes reactivos
  window.dispatchEvent(new Event('reservas_updated'));
  window.dispatchEvent(new Event('ventas_updated'));

  return {
    success: true,
    message: 'Datos de prueba transaccionales purgados con éxito.'
  };
}

/**
 * =========================================================================
 * 👠 MOTOR UNIVERSAL DE PRECIOS Y MEMORIA CONVERSACIONAL EN CHATBOT
 * =========================================================================
 */

/**
 * Normaliza cadenas de precio ("60.000", "60000", "60 mil", "60k") a número entero
 */
function parsearMontoUniversal(str) {
  if (!str) return null;
  let s = String(str).toLowerCase().trim();
  s = s.replace(/\$/g, '').replace(/\./g, '').replace(/\s+/g, '');
  if (s.includes('mil')) {
    s = s.replace(/mil/g, '') + '000';
  } else if (s.includes('k')) {
    s = s.replace(/k/g, '') + '000';
  }
  const num = parseInt(s.replace(/\D/g, ''), 10);
  return isNaN(num) ? null : num;
}

export async function consultarChatbot(mensaje, productosLocales = [], contextoPrevio = {}) {
  const normalizeText = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const qNorm = normalizeText(mensaje);

  // 1. FAQ PRIORITARIA: Envíos, Despachos y Entregas
  if (
    qNorm.includes('envio') || 
    qNorm.includes('despacho') || 
    qNorm.includes('starken') || 
    qNorm.includes('chilexpress') || 
    qNorm.includes('entrega') || 
    qNorm.includes('flete') ||
    qNorm.includes('delivery') ||
    qNorm === '🚚 envios' ||
    qNorm === 'envios' ||
    qNorm === 'despachos'
  ) {
    return {
      text: `📦 **Información de Entregas y Envíos:**\n\n• 📍 **Entrega Presencial:** Entregas coordinadas en Concepción Centro y Penco (sin costo adicional).\n• 🚚 **Envíos a Todo Chile:** Despachos por pagar mediante Starken o Chilexpress a domicilio o agencia.\n• ⏱️ **Tiempos de Despacho:** Los envíos se preparan y despachan en 24 a 48 hrs hábiles tras confirmada tu reserva/compra.`,
      tarjetasSugeridas: [],
      nuevoContexto: contextoPrevio
    };
  }

  // 2. FAQ PRIORITARIA: Modalidad de Tienda Online / Tienda Física
  if (
    qNorm.includes('tienda') || 
    qNorm.includes('local') || 
    qNorm.includes('direccion') || 
    qNorm.includes('donde') || 
    qNorm.includes('probar') || 
    qNorm.includes('ubicacion') ||
    qNorm === '👠 tienda online' ||
    qNorm === 'tienda online'
  ) {
    return {
      text: `👠 **Modalidad de Nuestra Tienda:**\n\nSomos una tienda **100% online** con precios de remate y liquidación directa de bodega, por lo que **no contamos con tienda física abierta al público** para probarse.\n\n📍 **Entregas Presenciales:** Realizamos entregas en **Concepción Centro y Penco** (sin costo adicional).\n📦 **Envíos a Todo Chile:** Despachos por pagar mediante Starken o Chilexpress a todo el país.\n\n¿Qué modelo, talla o color estás buscando hoy?`,
      tarjetasSugeridas: [],
      nuevoContexto: contextoPrevio
    };
  }

  // 3. Reset de contexto explícito
  if (qNorm.includes('reiniciar') || qNorm.includes('borrar') || qNorm.includes('nuevo')) {
    return {
      text: `¡Listo! He reiniciado nuestra conversación. ¿Qué modelo, talla o color estás buscando hoy?`,
      tarjetasSugeridas: [],
      nuevoContexto: {}
    };
  }

  const q = mensaje.toLowerCase().trim();

  // 5. Saludos iniciales
  if (q.includes('hola') || q.includes('buenas') || q.includes('inicio') || q.includes('menu')) {
    return {
      text: `¡Hola! Soy tu Asistente Virtual de Calzado 👠.\n\nNuestros modelos son 100% cuero genuino a precios de liquidación de bodega. ¿Qué modelo, talla o color estás buscando hoy? Por ejemplo:\n• "Zapatos negros"\n• "¿Tienen el modelo 105 en talla 37?"\n• "Zapatos de menos de 40 mil"`,
      tarjetasSugeridas: [],
      nuevoContexto: {}
    };
  }

  // =========================================================================
  // 4. EXTRACCIÓN DE SLOTS Y MEMORIA CONVERSACIONAL ACUMULATIVA
  // =========================================================================
  const nuevoContexto = { ...contextoPrevio };

  // A. Extracción de Precios (Universal)
  // Rango "entre X y Y"
  const matchRango = q.match(/(?:entre|de)\s*(\$?\s*[\d\.\s]+(?:mil|k)?)\s*(?:y|a|hasta)\s*(\$?\s*[\d\.\s]+(?:mil|k)?)/i);
  if (matchRango) {
    nuevoContexto.minPrice = parsearMontoUniversal(matchRango[1]);
    nuevoContexto.maxPrice = parsearMontoUniversal(matchRango[2]);
  } else {
    // Mínimo: "más de", "sobre", "mayor a", "superiores a", ">", "desde", "a partir de"
    const matchMin = q.match(/(?:m[aá]s\s+de|sobre|mayor(?:es)?\s+a|arriba\s+de|superior(?:es)?\s+a|>|desde|a\s+partir\s+de)\s*(\$?\s*[\d\.\s]+(?:mil|k)?)/i);
    if (matchMin) {
      nuevoContexto.minPrice = parsearMontoUniversal(matchMin[1]);
      nuevoContexto.maxPrice = null;
    }

    // Máximo: "menos de", "hasta", "menor a", "bajo", "inferior a", "<", "máximo de"
    const matchMax = q.match(/(?:menos\s+de|hasta|menor(?:es)?\s+a|bajo|inferior(?:es)?\s+a|<|m[aá]ximo\s+de|maximo\s+de)\s*(\$?\s*[\d\.\s]+(?:mil|k)?)/i);
    if (matchMax) {
      nuevoContexto.maxPrice = parsearMontoUniversal(matchMax[1]);
      nuevoContexto.minPrice = null;
    }
  }

  // B. Extracción de Talla (ej: 35, 36, 37, 38, 39, 40, 41, 42)
  const tallaMatch = q.match(/\b(3[4-9]|4[0-2])\b/);
  if (tallaMatch) {
    nuevoContexto.talla = tallaMatch[1];
  }

  // C. Extracción de Color
  const coloresPosibles = ['negro', 'rojo', 'suela', 'cafe', 'blanco', 'azul', 'camel', 'beige', 'nude', 'plata', 'oro', 'verde', 'burdeo', 'rosa'];
  const colorEncontrado = coloresPosibles.find(c => q.includes(c));
  if (colorEncontrado) {
    nuevoContexto.color = colorEncontrado;
  }

  // D. Extracción de Modelo
  const modeloMatch = productosLocales.find(p => q.includes(p.codigo_modelo?.toLowerCase()) || (p.nombre_fantasia && q.includes(p.nombre_fantasia.toLowerCase())));
  if (modeloMatch) {
    nuevoContexto.modelo_codigo = modeloMatch.codigo_modelo;
    nuevoContexto.modelo_nombre = modeloMatch.nombre_fantasia;
  }

  // E. Extracción de Categoría (zapatilla/s, botin/es, sandalia/s, bota/s, zapato/s)
  if (q.match(/\bzapatillas?\b|\bsneakers?\b/i)) {
    nuevoContexto.categoria = 'Zapatillas';
  } else if (q.match(/\bbotines?\b/i)) {
    nuevoContexto.categoria = 'Botines';
  } else if (q.match(/\bsandalias?\b|\bchalas?\b/i)) {
    nuevoContexto.categoria = 'Sandalias';
  } else if (q.match(/\bbotas?\b/i)) {
    nuevoContexto.categoria = 'Botas';
  } else if (q.match(/\bzapatos?\b/i)) {
    nuevoContexto.categoria = 'Zapatos';
  }

  // =========================================================================
  // 5. INTENCIÓN GUIADA: Si el usuario busca modelo/color/categoría SIN talla
  // =========================================================================
  const tieneTalla = Boolean(nuevoContexto.talla);
  const tieneColor = Boolean(nuevoContexto.color);
  const tieneModelo = Boolean(nuevoContexto.modelo_codigo);
  const tieneCategoria = Boolean(nuevoContexto.categoria);
  const tienePrecio = Boolean(nuevoContexto.minPrice || nuevoContexto.maxPrice);

  if (!tieneTalla && (tieneColor || tieneModelo || tieneCategoria || q.includes('taco') || q.includes('stiletto'))) {
    let detalleInteres = '';
    if (tieneModelo) detalleInteres = `el modelo ${nuevoContexto.modelo_codigo} (${nuevoContexto.modelo_nombre || ''})`;
    else if (tieneCategoria && tieneColor) detalleInteres = `${nuevoContexto.categoria.toLowerCase()} en color ${nuevoContexto.color}`;
    else if (tieneCategoria) detalleInteres = `${nuevoContexto.categoria.toLowerCase()} de cuero premium`;
    else if (tieneColor) detalleInteres = `calzados en color ${nuevoContexto.color}`;
    else detalleInteres = 'nuestro calzado en cuero genuino';

    return {
      text: `¡Excelente elección! Para verificar qué unidades nos quedan en bodega para ${detalleInteres}, ¿qué talla buscas? (ej: 35, 36, 37, 38, 39, 40)`,
      tarjetasSugeridas: [],
      nuevoContexto
    };
  }

  // =========================================================================
  // 6. BÚSQUEDA CRUZADA ESTRICTA CON FILTROS ACUMULADOS
  // =========================================================================
  const variantesDisponibles = [];

  productosLocales.forEach(prod => {
    // Coincidencia de modelo si está en el contexto
    const matchModelo = nuevoContexto.modelo_codigo
      ? prod.codigo_modelo === nuevoContexto.modelo_codigo
      : true;

    // Coincidencia de Categoría si está en el contexto
    const matchCategoria = nuevoContexto.categoria
      ? String(prod.categoria || '').toLowerCase() === nuevoContexto.categoria.toLowerCase()
      : true;

    if (!matchModelo || !matchCategoria) return;

    (prod.inventario_variantes || []).forEach(v => {
      if (v.stock_disponible <= 0) return;

      // Coincidencia de Color
      const matchColor = nuevoContexto.color
        ? v.color.toLowerCase().includes(nuevoContexto.color)
        : true;

      // Coincidencia de Talla
      const matchTalla = nuevoContexto.talla
        ? String(v.talla) === String(nuevoContexto.talla)
        : true;

      // Coincidencia de Precio
      const precio = Number(v.precio_vendedores);
      let matchPrecio = true;
      if (nuevoContexto.minPrice !== null && nuevoContexto.minPrice !== undefined && precio < nuevoContexto.minPrice) matchPrecio = false;
      if (nuevoContexto.maxPrice !== null && nuevoContexto.maxPrice !== undefined && precio > nuevoContexto.maxPrice) matchPrecio = false;

      if (matchColor && matchTalla && matchPrecio) {
        variantesDisponibles.push({
          id: v.id,
          variante_id: v.id,
          codigo: prod.codigo_modelo,
          codigo_modelo: prod.codigo_modelo,
          nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
          nombre_fantasia: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
          categoria: prod.categoria || '',
          material: prod.material,
          imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
          color: v.color,
          talla: v.talla,
          precio: precio,
          precio_vendedores: precio,
          stock: v.stock_disponible,
          producto_id: prod.id
        });
      }
    });
  });

  // CASO A: Quiebre de stock para la combinación cruzada acumulada
  if (variantesDisponibles.length === 0 && (tieneTalla || tieneColor || tieneModelo || tieneCategoria)) {
    // Buscar alternativas: en la misma talla consultada
    const alternativas = [];
    productosLocales.forEach(prod => {
      if (nuevoContexto.modelo_codigo && prod.codigo_modelo === nuevoContexto.modelo_codigo) {
        // Mismo modelo en otros colores con stock
        (prod.inventario_variantes || []).forEach(v => {
          if (v.stock_disponible > 0) {
            alternativas.push({
              id: v.id,
              variante_id: v.id,
              codigo: prod.codigo_modelo,
              codigo_modelo: prod.codigo_modelo,
              nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
              nombre_fantasia: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
              categoria: prod.categoria || '',
              material: prod.material,
              imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
              color: v.color,
              talla: v.talla,
              precio: Number(v.precio_vendedores),
              precio_vendedores: Number(v.precio_vendedores),
              stock: v.stock_disponible,
              producto_id: prod.id
            });
          }
        });
      } else if (nuevoContexto.talla) {
        // Otros modelos disponibles en esa talla (priorizando categoría si existe)
        const matchCatAlt = nuevoContexto.categoria
          ? String(prod.categoria || '').toLowerCase() === nuevoContexto.categoria.toLowerCase()
          : true;

        if (matchCatAlt) {
          (prod.inventario_variantes || []).forEach(v => {
            if (v.stock_disponible > 0 && String(v.talla) === String(nuevoContexto.talla)) {
              alternativas.push({
                id: v.id,
                variante_id: v.id,
                codigo: prod.codigo_modelo,
                codigo_modelo: prod.codigo_modelo,
                nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
                nombre_fantasia: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
                categoria: prod.categoria || '',
                material: prod.material,
                imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
                color: v.color,
                talla: v.talla,
                precio: Number(v.precio_vendedores),
                precio_vendedores: Number(v.precio_vendedores),
                stock: v.stock_disponible,
                producto_id: prod.id
              });
            }
          });
        }
      }
    });

    const descripAgotado = [
      nuevoContexto.modelo_codigo ? `el modelo ${nuevoContexto.modelo_codigo}` : '',
      nuevoContexto.categoria ? `en categoría ${nuevoContexto.categoria}` : '',
      nuevoContexto.color ? `color ${nuevoContexto.color}` : '',
      nuevoContexto.talla ? `en talla ${nuevoContexto.talla}` : ''
    ].filter(Boolean).join(' ');

    return {
      text: `Lamentablemente ${descripAgotado || 'esa combinación'} está agotado por remate de bodega.\n\n✨ Te sugiero estas excelentes alternativas disponibles que te van a encantar:`,
      tarjetasSugeridas: alternativas,
      nuevoContexto
    };
  }

  // CASO B: Éxito con disponibilidad encontrada
  if (variantesDisponibles.length > 0) {
    const filtrosTxt = [
      nuevoContexto.modelo_codigo ? `modelo ${nuevoContexto.modelo_codigo}` : '',
      nuevoContexto.categoria ? `categoría ${nuevoContexto.categoria}` : '',
      nuevoContexto.color ? `color ${nuevoContexto.color}` : '',
      nuevoContexto.talla ? `talla ${nuevoContexto.talla}` : '',
      nuevoContexto.minPrice ? `desde $${nuevoContexto.minPrice.toLocaleString('es-CL')}` : '',
      nuevoContexto.maxPrice ? `hasta $${nuevoContexto.maxPrice.toLocaleString('es-CL')}` : ''
    ].filter(Boolean).join(', ');

    return {
      text: `✨ Encontré ${variantesDisponibles.length} opción${variantesDisponibles.length > 1 ? 'es' : ''} disponible${variantesDisponibles.length > 1 ? 's' : ''} en bodega${filtrosTxt ? ` para ${filtrosTxt}` : ''}:`,
      tarjetasSugeridas: variantesDisponibles,
      nuevoContexto
    };
  }

  return {
    text: `No encontré calzados disponibles para esos filtros de liquidación en este momento. ¿Te gustaría consultar por otra talla o presupuesto?`,
    tarjetasSugeridas: [],
    nuevoContexto
  };
}
