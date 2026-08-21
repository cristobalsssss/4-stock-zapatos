import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar definidos en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const EXCEL_PATH = path.resolve(__dirname, '../data/inventario_real.xlsx');
const SHEET_NAME = 'Agosto-2026';
const TALLAS = [35, 36, 37, 38, 39, 40];

async function syncPreciosExcel() {
  console.log('======================================================================');
  console.log('🔄 ETL: ACTUALIZACIÓN DE PRECIOS EN SUPABASE DESDE EXCEL');
  console.log('======================================================================');
  console.log(`📁 Leyendo archivo: ${EXCEL_PATH}`);

  // 2. Leer Excel y procesar datos con Forward Fill
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
  
  if (!sheet) {
    throw new Error(`No se encontró la hoja ${SHEET_NAME} en el archivo Excel.`);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`📊 Filas detectadas en hoja '${SHEET_NAME}': ${rows.length}`);

  let curCodigo = null;
  let curNombre = null;
  let curPrecioInterno = 0;
  let curPrecioVendedores = 0;

  const parsedEntries = [];

  // Fila 4 es encabezado (índice 3), datos empiezan en fila 5 (índice 4)
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const cod = row[1];
    const nom = row[3];
    const pi = row[4];
    const pv = row[5];
    const color = row[10];

    // Lógica de Forward Fill para celdas combinadas / herencia
    if (cod) {
      curCodigo = String(cod).trim();
      curNombre = nom ? String(nom).trim() : curCodigo;
      curPrecioInterno = (pi !== null && pi !== undefined && !isNaN(Number(pi))) ? Number(pi) : 0;
      curPrecioVendedores = (pv !== null && pv !== undefined && !isNaN(Number(pv))) ? Number(pv) : 0;
    } else {
      if (pi !== null && pi !== undefined && !isNaN(Number(pi))) curPrecioInterno = Number(pi);
      if (pv !== null && pv !== undefined && !isNaN(Number(pv))) curPrecioVendedores = Number(pv);
    }

    if (color && curCodigo) {
      parsedEntries.push({
        codigo_modelo: curCodigo,
        nombre_fantasia: curNombre,
        color: String(color).trim(),
        precio_interno: curPrecioInterno,
        precio_vendedores: curPrecioVendedores,
        excel_row: r + 1
      });
    }
  }

  console.log(`📦 Grupos de color identificados con Forward Fill: ${parsedEntries.length}`);

  // 3. Obtener productos y variantes existentes en Supabase
  console.log('🔌 Conectando a Supabase para mapear productos y variantes...');
  const { data: productos, error: prodErr } = await supabase
    .from('productos')
    .select('id, codigo_modelo, nombre_fantasia');

  if (prodErr) {
    throw new Error(`Error al consultar productos: ${prodErr.message}`);
  }

  const prodMap = new Map();
  productos.forEach(p => prodMap.set(p.codigo_modelo, p.id));
  console.log(`✅ ${productos.length} productos mapeados en base de datos.`);

  const { data: variantes, error: varErr } = await supabase
    .from('inventario_variantes')
    .select('id, producto_id, color, talla, sku_variante, precio_interno, precio_vendedores');

  if (varErr) {
    throw new Error(`Error al consultar variantes: ${varErr.message}`);
  }

  const varMap = new Map();
  variantes.forEach(v => {
    const key = `${v.producto_id}|${v.color.trim().toLowerCase()}|${v.talla}`;
    varMap.set(key, v);
  });
  console.log(`✅ ${variantes.length} variantes actuales obtenidas de Supabase.`);

  // 4. Preparar actualizaciones de precios
  const updates = [];
  const samplePrices = [];

  for (const entry of parsedEntries) {
    const productoId = prodMap.get(entry.codigo_modelo);
    if (!productoId) {
      console.warn(`⚠️ Advertencia: Producto ${entry.codigo_modelo} no encontrado en base de datos.`);
      continue;
    }

    for (const talla of TALLAS) {
      const key = `${productoId}|${entry.color.toLowerCase()}|${talla}`;
      const varianteExistente = varMap.get(key);

      if (varianteExistente) {
        updates.push({
          id: varianteExistente.id,
          sku: varianteExistente.sku_variante,
          codigo_modelo: entry.codigo_modelo,
          nombre_fantasia: entry.nombre_fantasia,
          color: entry.color,
          talla: talla,
          precio_interno_anterior: varianteExistente.precio_interno,
          precio_vendedores_anterior: varianteExistente.precio_vendedores,
          precio_interno_nuevo: entry.precio_interno,
          precio_vendedores_nuevo: entry.precio_vendedores
        });
      }
    }
  }

  console.log(`\n🚀 Ejecutando UPDATEs en Supabase para ${updates.length} variantes...`);

  // 5. Ejecutar updates en lotes concurrentes para máxima velocidad y fiabilidad
  const BATCH_SIZE = 25;
  let totalActualizados = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(async (u) => {
      const { error: updateErr } = await supabase
        .from('inventario_variantes')
        .update({
          precio_vendedores: u.precio_vendedores_nuevo,
          precio_interno: u.precio_interno_nuevo,
          updated_at: new Date().toISOString()
        })
        .eq('id', u.id);

      if (updateErr) {
        console.error(`❌ Error actualizando variante ID ${u.id} (${u.sku}):`, updateErr.message);
      } else {
        totalActualizados++;
      }
    }));
  }

  // 6. Recolectar ejemplos representativos de precios cargados
  const distinctModelos = ['AA0002', 'AA0003', 'AA0005', 'CD0047', 'EE0083', 'CD0084'];
  distinctModelos.forEach(mod => {
    const match = updates.find(u => u.codigo_modelo === mod && u.talla === 37);
    if (match) {
      samplePrices.push(match);
    }
  });

  // 7. Resumen final en consola
  console.log('\n======================================================================');
  console.log('📊 RESUMEN DE ACTUALIZACIÓN DE PRECIOS');
  console.log('======================================================================');
  console.log(`• Total registros procesados desde Excel : ${updates.length}`);
  console.log(`• Total variantes actualizadas en Supabase : ${totalActualizados}`);
  console.log(`• Tasa de éxito                          : ${((totalActualizados / updates.length) * 100).toFixed(1)}%`);
  console.log('----------------------------------------------------------------------');
  console.log('🏷️  EJEMPLOS DE PRECIOS ACTUALIZADOS (Modelo | Nombre | Color | Talla | P.Interno | P.Vendedores):');
  console.log('----------------------------------------------------------------------');
  samplePrices.forEach(s => {
    console.log(`  👟 ${s.codigo_modelo.padEnd(7)} | ${s.nombre_fantasia.padEnd(12)} | ${s.color.padEnd(14)} | T${s.talla} | P.Int: $${s.precio_interno_nuevo.toLocaleString('es-CL').padStart(7)} -> P.Vend: $${s.precio_vendedores_nuevo.toLocaleString('es-CL').padStart(7)}`);
  });
  console.log('======================================================================\n');

  // 8. Verificación directa de base de datos
  const { data: checkData, error: checkErr } = await supabase
    .from('inventario_variantes')
    .select('id, precio_vendedores, precio_interno')
    .gt('precio_vendedores', 0);

  if (!checkErr && checkData) {
    console.log(`✅ Verificación Supabase: ${checkData.length} variantes tienen ahora precio_vendedores > 0.`);
    const sample = checkData[0];
    console.log(`   Ejemplo en BD -> P.Vendedores: $${sample.precio_vendedores.toLocaleString('es-CL')}, P.Interno: $${sample.precio_interno.toLocaleString('es-CL')}`);
  }
}

syncPreciosExcel().catch(err => {
  console.error('❌ Error fatal en ETL de precios:', err);
  process.exit(1);
});
