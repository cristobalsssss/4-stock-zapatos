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
    // Intentar primero por n8n Skill 2
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
  // 1. Obtener variante
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
    : (vendedor?.toLowerCase().includes('admin') || vendedor?.toLowerCase().includes('dueño') ? 0 : Math.max(0, (precioFinal - precioInterno) * cantidad));

  const montoTotal = precioFinal * cantidad;

  // 2. Insertar Venta
  const { data: venta, error: ventaErr } = await supabase
    .from('ventas')
    .insert({
      vendedor: vendedor || 'admin',
      medio_pago: medio_pago || 'Efectivo',
      tipo_operacion: 'Venta',
      monto_total: montoTotal,
      notas: notas || 'Venta desde Frontend',
      fecha_venta: fecha_venta || new Date().toISOString()
    })
    .select()
    .single();

  if (ventaErr) throw ventaErr;

  // 3. Descontar Stock
  const nuevoStock = variante.stock_disponible - cantidad;
  const { error: stockErr } = await supabase
    .from('inventario_variantes')
    .update({ stock_disponible: nuevoStock, updated_at: new Date().toISOString() })
    .eq('id', variante_id);

  if (stockErr) throw stockErr;

  // 4. Registrar Movimiento Kardex
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
 * Sube una imagen a Supabase Storage en el bucket 'productos-imagenes'
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
    // Si falla productos-imagenes, probar con calzado-imagenes
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

/**
 * Actualiza la imagen por defecto de un modelo en la tabla 'productos'
 */
export async function actualizarImagenModelo(productoId, url) {
  const { error } = await supabase
    .from('productos')
    .update({ imagen_defecto_url: url, updated_at: new Date().toISOString() })
    .eq('id', productoId);
  if (error) throw error;
}

/**
 * Elimina la imagen por defecto de un modelo
 */
export async function eliminarImagenModelo(productoId) {
  const { error } = await supabase
    .from('productos')
    .update({ imagen_defecto_url: null, updated_at: new Date().toISOString() })
    .eq('id', productoId);
  if (error) throw error;
}

/**
 * Actualiza la imagen de portada para TODAS las variantes de un (producto_id, color)
 */
export async function actualizarImagenColor(productoId, color, url) {
  const { error } = await supabase
    .from('inventario_variantes')
    .update({ imagen_portada_variante: url, updated_at: new Date().toISOString() })
    .eq('producto_id', productoId)
    .eq('color', color);
  if (error) throw error;
}

/**
 * Elimina la imagen de portada para todas las variantes de un (producto_id, color)
 */
export async function eliminarImagenColor(productoId, color) {
  const { error } = await supabase
    .from('inventario_variantes')
    .update({ imagen_portada_variante: null, updated_at: new Date().toISOString() })
    .eq('producto_id', productoId)
    .eq('color', color);
  if (error) throw error;
}

/**
 * Añade una imagen a la Galería General de una variante o color
 */
export async function agregarImagenGaleriaColor(productoId, color, url) {
  // Obtener una variante de ese color para asociar la foto en la BD
  const { data: variante, error: vErr } = await supabase
    .from('inventario_variantes')
    .select('id')
    .eq('producto_id', productoId)
    .eq('color', color)
    .limit(1)
    .single();

  if (vErr || !variante) {
    // Si no se encuentra variante específica, tomar cualquier variante del producto
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

/**
 * Elimina una imagen de la galería por su ID
 */
export async function eliminarImagenGaleria(imagenId) {
  const { error } = await supabase
    .from('imagenes_variante')
    .delete()
    .eq('id', imagenId);
  if (error) throw error;
}

/**
 * Consulta el historial de movimientos de inventario (Kardex) con datos de ventas y variantes
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
 * Configuración dinámica de la tienda y parámetros de contacto
 */
const DEFAULT_CONFIG = {
  telefono_whatsapp: '+56993125219',
  nombre_duena: 'Carmen',
  modalidad_tienda: 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
  entregas_locales: 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
  envios_nacionales: 'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
};

export async function getConfiguracion() {
  try {
    const local = localStorage.getItem('boutique_configuracion');
    if (local) return { ...DEFAULT_CONFIG, ...JSON.parse(local) };
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_CONFIG;
}

export async function guardarConfiguracion(nuevaConfig) {
  try {
    const configCompleta = { ...DEFAULT_CONFIG, ...nuevaConfig };
    localStorage.setItem('boutique_configuracion', JSON.stringify(configCompleta));
    return configCompleta;
  } catch (e) {
    console.error('Error al guardar configuración:', e);
    throw e;
  }
}

/**
 * Gestión de Reservas de Clientes (Ciclo de Vida)
 */
export async function getReservas() {
  try {
    // Intentar consultar tabla reservas en Supabase si existe
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) return data;
  } catch (err) {
    console.warn('Tabla reservas no disponible en Supabase, utilizando fallback persistente:', err);
  }

  // Fallback persistente en localStorage
  try {
    const local = localStorage.getItem('boutique_reservas');
    return local ? JSON.parse(local) : [];
  } catch {
    return [];
  }
}

export async function guardarReserva(reservaData) {
  const nuevaReserva = {
    id: `res-${Date.now()}`,
    created_at: new Date().toISOString(),
    cliente_nombre: reservaData.cliente_nombre,
    cliente_whatsapp: reservaData.cliente_whatsapp,
    cliente_comuna: reservaData.cliente_comuna,
    notas: reservaData.notas || '',
    items: reservaData.items || [],
    total: reservaData.total || 0,
    estado: 'Pendiente' // 'Pendiente' | 'Completada' | 'Cancelada'
  };

  try {
    // Intentar insertar en Supabase
    const { data, error } = await supabase
      .from('reservas')
      .insert({
        cliente_nombre: nuevaReserva.cliente_nombre,
        cliente_whatsapp: nuevaReserva.cliente_whatsapp,
        cliente_comuna: nuevaReserva.cliente_comuna,
        notas: nuevaReserva.notas,
        items: nuevaReserva.items,
        total: nuevaReserva.total,
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

  // Guardar en localStorage
  try {
    const prev = await getReservas();
    const actualizadas = [nuevaReserva, ...prev.filter(r => r.id !== nuevaReserva.id)];
    localStorage.setItem('boutique_reservas', JSON.stringify(actualizadas));
  } catch (e) {
    console.error(e);
  }

  return nuevaReserva;
}

export async function actualizarEstadoReserva(reservaId, nuevoEstado) {
  try {
    await supabase
      .from('reservas')
      .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
      .eq('id', reservaId);
  } catch (err) {
    console.warn('Fallo actualización en Supabase de reserva:', err);
  }

  // Actualizar en localStorage
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
 * Envía consulta al Chatbot Asistente vía n8n con fallback inteligente y contexto de negocio
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
          modelosMencionados: data.modelos || []
        };
      }
    }
  } catch (err) {
    console.warn('Chatbot n8n no disponible o en reposo, usando asistente local inteligente:', err);
  }

  // Fallback Asistente Local Inteligente con Contexto de Negocio
  const q = mensaje.toLowerCase().trim();

  // 1. Preguntas sobre Tienda Física, Prueba o Ubicación
  if (q.includes('tienda') || q.includes('local') || q.includes('direccion') || q.includes('donde') || q.includes('probar') || q.includes('ubicacion')) {
    return {
      text: `👠 *Modalidad de Nuestra Tienda:*\n\nSomos una tienda *100% online* con precios de remate y liquidación directa de bodega, por lo que *no contamos con tienda física abierta al público* para probarse.\n\n📍 *Entregas Presenciales:* Realizamos entregas en *Concepción y Penco* (a coordinar directamente con Carmen).\n📦 *Envíos a Todo Chile:* Enviamos por *Starken en modalidad Por Pagar*.\n\n¿Te gustaría revisar las opciones disponibles en tu talla?`,
      modelosMencionados: []
    };
  }

  // 2. Preguntas sobre Envíos o Entregas
  if (q.includes('envio') || q.includes('starken') || q.includes('despacho') || q.includes('entrega') || q.includes('concepcion') || q.includes('penco')) {
    return {
      text: `🚚 *Opciones de Entrega y Envíos:*\n\n1. *Presencial (Sin costo de envío):* Entregas en *Concepción y Penco*, coordinando día y hora con Carmen.\n2. *A Todo Chile:* Envíos a domicilio o sucursal vía *Starken (Por Pagar)* con número de seguimiento.\n\n¿Quieres consultar la disponibilidad de algún modelo antes de reservar?`,
      modelosMencionados: []
    };
  }

  // 3. Saludos o menú inicial
  if (q.includes('hola') || q.includes('buenas') || q.includes('inicio') || q.includes('menu')) {
    return {
      text: `¡Hola! Soy tu Asistente Virtual de Calzado 👠.\n\nNuestros modelos son 100% cuero genuino a precios de liquidación de bodega. ¿Qué modelo, talla o color estás buscando hoy? Por ejemplo:\n• "¿Tienen el modelo 105 en talla 37?"\n• "¿Qué modelos tienen en color Rojo?"\n• "¿Cómo funcionan los envíos?"`,
      modelosMencionados: []
    };
  }

  // 4. Buscar talla y coincidencias en catálogo
  const tallaMatch = q.match(/\b(3[4-9]|4[0-2])\b/);
  const tallaBuscada = tallaMatch ? tallaMatch[1] : null;

  // Detectar si el usuario preguntó por un modelo específico (ej: 105, 110, 114, AA0001, etc.)
  const modeloMatch = productosLocales.find(p => q.includes(p.codigo_modelo?.toLowerCase()));

  const resultados = [];
  const modelosMencionados = [];

  productosLocales.forEach(prod => {
    const codigoCoincide = q.includes(prod.codigo_modelo?.toLowerCase());
    const nombreCoincide = prod.nombre_fantasia && q.includes(prod.nombre_fantasia.toLowerCase());

    const variantesDisponibles = (prod.inventario_variantes || []).filter(v => {
      if (v.stock_disponible <= 0) return false;
      const colorMatch = q.includes(v.color.toLowerCase());
      const tallaExacta = tallaBuscada ? String(v.talla) === String(tallaBuscada) : true;

      if (codigoCoincide || nombreCoincide) {
        return tallaBuscada ? tallaExacta : true;
      }
      return colorMatch && (tallaBuscada ? tallaExacta : true);
    });

    if (variantesDisponibles.length > 0) {
      resultados.push({
        codigo: prod.codigo_modelo,
        nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
        material: prod.material,
        variantes: variantesDisponibles
      });
      if (!modelosMencionados.includes(prod.codigo_modelo)) {
        modelosMencionados.push(prod.codigo_modelo);
      }
    }
  });

  // Si preguntó por un modelo específico que está agotado o no tiene esa talla:
  if (modeloMatch && resultados.length === 0) {
    // Buscar 2-3 alternativas disponibles en la talla buscada
    const alternativas = [];
    productosLocales.forEach(prod => {
      if (prod.codigo_modelo === modeloMatch.codigo_modelo) return;
      const vTalla = (prod.inventario_variantes || []).filter(v => 
        v.stock_disponible > 0 && (tallaBuscada ? String(v.talla) === String(tallaBuscada) : true)
      );
      if (vTalla.length > 0) {
        alternativas.push({
          codigo: prod.codigo_modelo,
          nombre: prod.nombre_fantasia || `Modelo ${prod.codigo_modelo}`,
          variantes: vTalla
        });
      }
    });

    let respuesta = `⚠️ *Ese modelo ${tallaBuscada ? `en talla ${tallaBuscada}` : ''} se encuentra agotado*, ya que son precios de remate de bodega y nos quedan las últimas unidades.\n\n`;
    if (alternativas.length > 0) {
      respuesta += `✨ *Te sugiero estas excelentes alternativas en stock${tallaBuscada ? ` para talla ${tallaBuscada}` : ''}:*\n\n`;
      alternativas.slice(0, 3).forEach(alt => {
        respuesta += `👟 *${alt.codigo} - ${alt.nombre}*\n`;
        alt.variantes.slice(0, 2).forEach(v => {
          respuesta += `   • Color ${v.color} | Talla ${v.talla} (${v.stock_disponible}p disp.) - $${Number(v.precio_vendedores).toLocaleString('es-CL')}\n`;
        });
      });
      respuesta += `\n¿Te gustaría ver alguno en detalle o reservarlo con Carmen vía WhatsApp?`;
      return {
        text: respuesta,
        modelosMencionados: alternativas.slice(0, 3).map(a => a.codigo)
      };
    }

    return {
      text: `⚠️ *Ese modelo se encuentra agotado*, ya que son precios de remate de bodega. Puedes explorar nuestro catálogo completo para descubrir más opciones en cuero genuino.`,
      modelosMencionados: []
    };
  }

  // Si hay resultados disponibles:
  if (resultados.length > 0) {
    let respuesta = `✨ *Disponibilidad encontrada en bodega:*\n\n`;
    resultados.slice(0, 3).forEach(r => {
      respuesta += `👟 *${r.codigo} - ${r.nombre}* (${r.material || 'Cuero'})\n`;
      r.variantes.slice(0, 3).forEach(v => {
        respuesta += `   • Color ${v.color} | Talla ${v.talla} (${v.stock_disponible} par${v.stock_disponible > 1 ? 'es' : ''}) - $${Number(v.precio_vendedores).toLocaleString('es-CL')}\n`;
      });
      respuesta += `\n`;
    });
    respuesta += `💡 _Haz clic en los botones de abajo para ver la ficha del modelo o abre el botón de WhatsApp para reservar directamente con Carmen._`;

    return {
      text: respuesta,
      modelosMencionados: modelosMencionados.slice(0, 4)
    };
  }

  return {
    text: `No encontré disponibilidad exacta para esa combinación en este momento, ya que nos quedan las últimas unidades de remate. ¿Te gustaría consultar directamente con Carmen por WhatsApp para verificar si hay pares similares?`,
    modelosMencionados: []
  };
}


