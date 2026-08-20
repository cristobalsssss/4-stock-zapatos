import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  user: 'postgres.leifskqgupgsajgemgul',
  host: 'aws-0-ca-central-1.pooler.supabase.com',
  database: 'postgres',
  password: 'Gaspi.123#2026',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('🚀 Iniciando sincronización de catálogo e inventario (732 variantes)...');
  const raw = fs.readFileSync('data/inventario_parsed.json', 'utf8');
  const data = JSON.parse(raw);

  console.log(`📦 Productos a sincronizar: ${data.productos.length}`);
  console.log(`👟 Variantes a sincronizar: ${data.variantes.length}`);

  await client.connect();
  console.log('🔌 Conexión a Supabase establecida.');

  await client.query('BEGIN');

  try {
    // 1. Sincronizar productos
    const prodIdMap = {};
    for (const p of data.productos) {
      const q = `
        INSERT INTO public.productos (codigo_modelo, nombre_fantasia, material, taco_base, horma, info_adicional)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (codigo_modelo) DO UPDATE SET
          nombre_fantasia = EXCLUDED.nombre_fantasia,
          material = COALESCE(EXCLUDED.material, productos.material),
          taco_base = COALESCE(EXCLUDED.taco_base, productos.taco_base),
          horma = COALESCE(EXCLUDED.horma, productos.horma),
          info_adicional = COALESCE(EXCLUDED.info_adicional, productos.info_adicional),
          updated_at = timezone('utc'::text, now())
        RETURNING id;
      `;
      const res = await client.query(q, [
        p.codigo_modelo,
        p.nombre_fantasia,
        p.material,
        p.taco_base,
        p.horma,
        p.info_adicional
      ]);
      prodIdMap[p.codigo_modelo] = res.rows[0].id;
    }
    console.log(`✅ ${Object.keys(prodIdMap).length} productos actualizados/creados.`);

    // 2. Primero actualizamos los SKU de las variantes existentes para evitar cualquier conflicto de clave única
    // durante los nuevos inserts
    console.log('🔄 Actualizando SKUs y datos de variantes...');
    
    // Para asegurar inserción limpia sin colisiones intermedias:
    for (const v of data.variantes) {
      const pid = prodIdMap[v.codigo_modelo];
      const q = `
        INSERT INTO public.inventario_variantes
          (producto_id, sku_variante, color, talla, stock_disponible, precio_interno, precio_vendedores)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (producto_id, color, talla) DO UPDATE SET
          sku_variante = EXCLUDED.sku_variante,
          stock_disponible = EXCLUDED.stock_disponible,
          precio_interno = EXCLUDED.precio_interno,
          precio_vendedores = EXCLUDED.precio_vendedores,
          updated_at = timezone('utc'::text, now());
      `;
      await client.query(q, [
        pid,
        v.sku_variante,
        v.color,
        v.talla,
        v.stock,
        v.precio_interno,
        v.precio_vendedores
      ]);
    }

    await client.query('COMMIT');
    console.log('🎉 Transacción confirmada (COMMIT) con éxito.');

    // Validar conteo total
    const countRes = await client.query('SELECT count(*) FROM public.inventario_variantes;');
    console.log(`\n📊 Conteo total de variantes en BD: ${countRes.rows[0].count} (Esperado: 732)`);

    // Validar Alicante específicamente
    const aliRes = await client.query(`
      SELECT p.codigo_modelo, p.nombre_fantasia, v.color, v.talla, v.stock_disponible, v.sku_variante
      FROM public.inventario_variantes v
      JOIN public.productos p ON p.id = v.producto_id
      WHERE p.codigo_modelo = 'CD0047'
      ORDER BY v.color, v.talla;
    `);
    console.log(`\n🔍 Verificación Alicante CD0047 (${aliRes.rows.length} registros):`);
    console.table(aliRes.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la sincronización, se hizo ROLLBACK:', err);
  } finally {
    await client.end();
  }
}

main();
