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
      headers: { 'Content-Type': 'application/json' },
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
  const comisionFinal = comision_vendedor !== undefined && comision_vendedor !== null
    ? comision_vendedor
    : (vendedor?.toLowerCase().includes('admin') || vendedor?.toLowerCase().includes('dueño') || vendedor?.toLowerCase().includes('carmen') ? 0 : Math.max(0, (precioFinal - precioInterno) * cantidad));

  const montoTotal = precioFinal * cantidad;

  // Insertar Venta
  const { data: venta, error: ventaErr } = await supabase
    .from('ventas')
    .insert({
      vendedor: vendedor || 'admin_carmen',
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
      notas: notas || 'Venta directa'
    });

  if (movErr) console.warn('Error al registrar detalle movimiento:', movErr);

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variante_id, cantidad, motivo, venta_id }),
    });

    if (res.ok) {
      return await res.json();
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
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    const { data: fallbackData, error: fbError } = await supabase.storage
      .from('calzado-imagenes')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (fbError) throw fbError;
    const { data: publicUrlData } = supabase.storage.from('calzado-imagenes').getPublicUrl(fileName);
    return publicUrlData.publicUrl;
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
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
  telefono_whatsapp: '+56993125219',
  nombre_vendedora: 'Carmen',
  modalidad_tienda: 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
  entregas_locales: 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
  envios_nacionales: 'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
};

export async function getConfiguracion() {
  try {
    // Intentar leer de Supabase tabla configuracion si existe
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    // Fallback a localStorage
  }

  try {
    const local = localStorage.getItem('boutique_configuracion');
    if (local) return { ...DEFAULT_CONFIG, ...JSON.parse(local) };
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CONFIG;
}

export async function guardarConfiguracion(nuevaConfig) {
  const configCompleta = { ...DEFAULT_CONFIG, ...nuevaConfig };

  try {
    // Intentar guardar en Supabase
    await supabase
      .from('configuracion')
      .upsert({
        id: 1,
        telefono_whatsapp: configCompleta.telefono_whatsapp,
        nombre_vendedora: configCompleta.nombre_vendedora || configCompleta.nombre_duena,
        modalidad_tienda: configCompleta.modalidad_tienda,
        entregas_locales: configCompleta.entregas_locales,
        envios_nacionales: configCompleta.envios_nacionales,
        updated_at: new Date().toISOString()
      });
  } catch (err) {
    console.warn('Fallback a almacenamiento local para configuracion:', err);
  }

  try {
    localStorage.setItem('boutique_configuracion', JSON.stringify(configCompleta));
  } catch (e) {
    console.error('Error al guardar configuración localmente:', e);
  }

  return configCompleta;
}

/**
 * =========================================================================
 * 📋 GESTIÓN Y PERSISTENCIA REAL DE RESERVAS EN SUPABASE
 * =========================================================================
 */
export async function getReservas() {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) return data;
  } catch (err) {
    console.warn('Tabla reservas no disponible en Supabase, utilizando fallback persistente:', err);
  }

  try {
    const local = localStorage.getItem('boutique_reservas');
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

/**
 * Crea una reserva en Supabase con fallback a localStorage
 */
export async function crearReserva({
  cliente_nombre,
  cliente_whatsapp,
  cliente_comuna,
  tipo_entrega = 'Presencial',
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
  const nuevaReserva = {
    id: `res-${Date.now()}`,
    cliente_nombre: cliente_nombre?.trim(),
    cliente_whatsapp: cliente_whatsapp?.trim(),
    cliente_comuna: cliente_comuna?.trim(),
    tipo_entrega: tipo_entrega?.trim() || 'Presencial Concepción/Penco',
    variante_id: variante_id || items[0]?.variante_id || null,
    modelo_codigo: modelo_codigo || items[0]?.codigo_modelo || 'N/A',
    modelo_nombre: modelo_nombre || items[0]?.nombre_fantasia || '',
    color: color || items[0]?.color || '',
    talla: talla ? String(talla) : String(items[0]?.talla || ''),
    cantidad: cantidad || items.reduce((acc, i) => acc + (i.quantity || 1), 0) || 1,
    precio_unitario: Number(precio_unitario) || Number(items[0]?.precio || 0),
    notas: notas?.trim() || '',
    items: items || [],
    total: Number(precio_unitario * (cantidad || 1)) || items.reduce((acc, i) => acc + (i.precio * i.quantity), 0) || 0,
    estado: 'Pendiente',
    created_at: new Date().toISOString()
  };

  try {
    // Inserción en tabla reservas de Supabase
    const { data, error } = await supabase
      .from('reservas')
      .insert({
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
        estado: 'Pendiente'
      })
      .select()
      .single();

    if (!error && data) {
      nuevaReserva.id = data.id;
    }
  } catch (err) {
    console.warn('Fallback a almacenamiento local para reserva:', err);
  }

  // Guardar en localStorage para respaldo y sincronización inmediata
  try {
    const prev = await getReservas();
    const actualizadas = [nuevaReserva, ...prev.filter(r => r.id !== nuevaReserva.id)];
    localStorage.setItem('boutique_reservas', JSON.stringify(actualizadas));
  } catch (e) {
    console.error(e);
  }

  return nuevaReserva;
}

export const guardarReserva = crearReserva; // Alias para compatibilidad

export async function actualizarEstadoReserva(reservaId, nuevoEstado) {
  try {
    await supabase
      .from('reservas')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', reservaId);
  } catch (err) {
    console.warn('Fallo actualización en Supabase de reserva:', err);
  }

  try {
    const list = await getReservas();
    const actualizadas = list.map(r => r.id === reservaId ? { ...r, estado: nuevoEstado } : r);
    localStorage.setItem('boutique_reservas', JSON.stringify(actualizadas));
    return actualizadas;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

/**
 * =========================================================================
 * 👠 MOTOR INTELIGENTE DE RECOMENDACIONES EN CHATBOT (TARJETAS VISUALES)
 * =========================================================================
 */
export async function consultarChatbot(mensaje, productosLocales = []) {
  try {
    const res = await fetch(`${N8N_URL}/webhook/chatbot-stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.respuesta || data.text || data.message)) {
        return {
          text: data.respuesta || data.text || data.message,
          tarjetasSugeridas: data.tarjetas || []
        };
      }
    }
  } catch (err) {
    console.warn('Chatbot n8n no disponible o en reposo, usando asistente local inteligente:', err);
  }

  // Fallback Asistente Local Inteligente
  const q = mensaje.toLowerCase().trim();

  // 1. Preguntas sobre Tienda Física o Ubicación
  if (q.includes('tienda') || q.includes('local') || q.includes('direccion') || q.includes('donde') || q.includes('probar') || q.includes('ubicacion')) {
    return {
      text: `👠 *Modalidad de Nuestra Tienda:*\n\nSomos una tienda *100% online* con precios de remate y liquidación directa de bodega, por lo que *no contamos con tienda física abierta al público* para probarse.\n\n📍 *Entregas Presenciales:* Realizamos entregas en *Concepción y Penco* (a coordinar directamente con nuestra vendedora).\n📦 *Envíos a Todo Chile:* Enviamos por *Starken en modalidad Por Pagar*.\n\n¿Te gustaría revisar las opciones disponibles en tu talla?`,
      tarjetasSugeridas: []
    };
  }

  // 2. Preguntas sobre Envíos o Entregas
  if (q.includes('envio') || q.includes('starken') || q.includes('despacho') || q.includes('entrega') || q.includes('concepcion') || q.includes('penco')) {
    return {
      text: `🚚 *Opciones de Entrega y Envíos:*\n\n1. *Presencial (Sin costo de envío):* Entregas en *Concepción y Penco*, coordinando día y hora con la vendedora.\n2. *A Todo Chile:* Envíos a domicilio o sucursal vía *Starken (Por Pagar)* con número de seguimiento.\n\n¿Quieres consultar la disponibilidad de algún modelo antes de reservar?`,
      tarjetasSugeridas: []
    };
  }

  // 3. Saludos iniciales
  if (q.includes('hola') || q.includes('buenas') || q.includes('inicio') || q.includes('menu')) {
    return {
      text: `¡Hola! Soy tu Asistente Virtual de Calzado 👠.\n\nNuestros modelos son 100% cuero genuino a precios de liquidación de bodega. ¿Qué modelo, talla o color estás buscando hoy? Por ejemplo:\n• "¿Tienen el modelo 105 en talla 37?"\n• "¿Qué modelos tienen en color Rojo?"\n• "¿Cómo funcionan los envíos?"`,
      tarjetasSugeridas: []
    };
  }

  // 4. Extracción de filtros
  const tallaMatch = q.match(/\b(3[4-9]|4[0-2])\b/);
  const tallaBuscada = tallaMatch ? tallaMatch[1] : null;
  const modeloMatch = productosLocales.find(p => q.includes(p.codigo_modelo?.toLowerCase()));

  // Colores detectados en la consulta
  const colorBuscado = ['negro', 'rojo', 'suela', 'cafe', 'blanco', 'azul', 'camel', 'beige', 'nude', 'plata', 'oro'].find(c => q.includes(c));

  // Buscar si hay stock exacto del modelo o variantes buscadas
  const variantesDisponiblesExactas = [];

  productosLocales.forEach(prod => {
    const matchCod = q.includes(prod.codigo_modelo?.toLowerCase());
    const matchNom = prod.nombre_fantasia && q.includes(prod.nombre_fantasia.toLowerCase());

    (prod.inventario_variantes || []).forEach(v => {
      if (v.stock_disponible <= 0) return;
      const matchCol = colorBuscado ? v.color.toLowerCase().includes(colorBuscado) : true;
      const matchTal = tallaBuscada ? String(v.talla) === String(tallaBuscada) : true;

      if ((matchCod || matchNom) && matchCol && matchTal) {
        variantesDisponiblesExactas.push({
          codigo: prod.codigo_modelo,
          nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
          material: prod.material,
          imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
          color: v.color,
          talla: v.talla,
          precio: Number(v.precio_vendedores),
          stock: v.stock_disponible,
          variante_id: v.id,
          producto_id: prod.id
        });
      }
    });
  });

  // CASO 1: Si preguntó por un modelo específico pero no hay stock exacto en esa talla/color (QUIEBRE DE STOCK)
  if (modeloMatch && variantesDisponiblesExactas.length === 0) {
    // PRIORIDAD 1: Mismo modelo en otros colores con stock
    const mismoModeloOtrosColores = [];
    (modeloMatch.inventario_variantes || []).forEach(v => {
      if (v.stock_disponible > 0 && (tallaBuscada ? String(v.talla) === String(tallaBuscada) : true)) {
        mismoModeloOtrosColores.push({
          codigo: modeloMatch.codigo_modelo,
          nombre: modeloMatch.nombre_fantasia || `Modelo ${modeloMatch.codigo_modelo}`,
          material: modeloMatch.material,
          imagen_url: v.imagen_portada_variante || modeloMatch.imagen_defecto_url,
          color: v.color,
          talla: v.talla,
          precio: Number(v.precio_vendedores),
          stock: v.stock_disponible,
          variante_id: v.id,
          producto_id: modeloMatch.id
        });
      }
    });

    // PRIORIDAD 2: Otros modelos en la MISMA talla consultada y preferentemente mismo color
    const otrosModelosMismaTalla = [];
    productosLocales.forEach(prod => {
      if (prod.codigo_modelo === modeloMatch.codigo_modelo) return;
      (prod.inventario_variantes || []).forEach(v => {
        if (v.stock_disponible > 0 && (tallaBuscada ? String(v.talla) === String(tallaBuscada) : true)) {
          otrosModelosMismaTalla.push({
            codigo: prod.codigo_modelo,
            nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
            material: prod.material,
            imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
            color: v.color,
            talla: v.talla,
            precio: Number(v.precio_vendedores),
            stock: v.stock_disponible,
            variante_id: v.id,
            producto_id: prod.id
          });
        }
      });
    });

    const sugerencias = [...mismoModeloOtrosColores, ...otrosModelosMismaTalla].slice(0, 4);

    const mensajeAgotado = `Lamentablemente el ${modeloMatch.codigo_modelo} ${tallaBuscada ? `en talla ${tallaBuscada}` : ''} ${colorBuscado ? `color ${colorBuscado}` : ''} está agotado por remate de bodega.\n\n✨ Te preparé estas excelentes alternativas disponibles en cuero genuino que te van a encantar:`;

    return {
      text: mensajeAgotado,
      tarjetasSugeridas: sugerencias
    };
  }

  // CASO 2: Si hay disponibilidad exacta
  if (variantesDisponiblesExactas.length > 0) {
    return {
      text: `✨ ¡Buenas noticias! Tenemos disponibilidad en bodega para lo que buscas. Puedes ver la ficha en el catálogo o reservar directamente desde aquí:`,
      tarjetasSugeridas: variantesDisponiblesExactas.slice(0, 4)
    };
  }

  // CASO 3: Búsqueda general por talla o color (sin modelo específico)
  const coincidenciasGenerales = [];
  productosLocales.forEach(prod => {
    (prod.inventario_variantes || []).forEach(v => {
      if (v.stock_disponible <= 0) return;
      const matchCol = colorBuscado ? v.color.toLowerCase().includes(colorBuscado) : true;
      const matchTal = tallaBuscada ? String(v.talla) === String(tallaBuscada) : true;

      if (matchCol && matchTal) {
        coincidenciasGenerales.push({
          codigo: prod.codigo_modelo,
          nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
          material: prod.material,
          imagen_url: v.imagen_portada_variante || prod.imagen_defecto_url,
          color: v.color,
          talla: v.talla,
          precio: Number(v.precio_vendedores),
          stock: v.stock_disponible,
          variante_id: v.id,
          producto_id: prod.id
        });
      }
    });
  });

  if (coincidenciasGenerales.length > 0) {
    return {
      text: `✨ Encontré estos modelos disponibles ${tallaBuscada ? `en talla ${tallaBuscada}` : ''} ${colorBuscado ? `color ${colorBuscado}` : ''}:`,
      tarjetasSugeridas: coincidenciasGenerales.slice(0, 4)
    };
  }

  return {
    text: `No encontré pares disponibles para esa combinación exacta en este momento debido al remate de bodega. Puedes consultar directamente por WhatsApp para verificar si hay opciones similares.`,
    tarjetasSugeridas: []
  };
}
