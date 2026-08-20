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
  console.log('🚀 Iniciando sincronización ultrarrápida de inventario...');
  const raw = fs.readFileSync('data/inventario_parsed.json', 'utf8');
  const data = JSON.parse(raw);

  await client.connect();
  console.log('🔌 Conectado a Supabase PostgreSQL.');

  await client.query('BEGIN');

  try {
    // 1. Asegurar que todos los 84 productos existan y obtener el mapa
    console.log('📦 1. Sincronizando productos...');
    for (const p of data.productos) {
      await client.query(`
        INSERT INTO public.productos (codigo_modelo, nombre_fantasia, material, taco_base, horma, info_adicional)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (codigo_modelo) DO UPDATE SET
          nombre_fantasia = EXCLUDED.nombre_fantasia,
          material = COALESCE(EXCLUDED.material, productos.material),
          taco_base = COALESCE(EXCLUDED.taco_base, productos.taco_base),
          horma = COALESCE(EXCLUDED.horma, productos.horma),
          info_adicional = COALESCE(EXCLUDED.info_adicional, productos.info_adicional),
          updated_at = now();
      `, [p.codigo_modelo, p.nombre_fantasia, p.material, p.taco_base, p.horma, p.info_adicional]);
    }

    const prodRes = await client.query('SELECT id, codigo_modelo FROM public.productos;');
    const prodMap = {};
    prodRes.rows.forEach(r => { prodMap[r.codigo_modelo] = r.id; });
    console.log(`✅ ${Object.keys(prodMap).length} productos mapeados.`);

    // 2. Actualizar primero los SKUs existentes con la fórmula completa sin colisiones
    console.log('🔄 2. Actualizando SKUs existentes para liberar colisiones...');
    await client.query(`
      UPDATE public.inventario_variantes v
      SET sku_variante = CONCAT(p.codigo_modelo, '-', UPPER(REGEXP_REPLACE(v.color, '[^A-Za-z0-9]', '', 'g')), '-', v.talla)
      FROM public.productos p
      WHERE v.producto_id = p.id;
    `);

    // 3. Insertar / Actualizar todas las 732 variantes en lotes usando multi-row VALUES
    console.log('👟 3. Upserting 732 variantes en lotes optimizados...');
    const valuesList = [];
    const params = [];
    let pIdx = 1;

    for (const v of data.variantes) {
      const pid = prodMap[v.codigo_modelo];
      valuesList.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6})`);
      params.push(pid, v.sku_variante, v.color, v.talla, v.stock, v.precio_interno, v.precio_vendedores);
      pIdx += 7;
    }

    const multiRowQuery = `
      INSERT INTO public.inventario_variantes
        (producto_id, sku_variante, color, talla, stock_disponible, precio_interno, precio_vendedores)
      VALUES
        ${valuesList.join(',\n')}
      ON CONFLICT (producto_id, color, talla) DO UPDATE SET
        sku_variante = EXCLUDED.sku_variante,
        stock_disponible = EXCLUDED.stock_disponible,
        precio_interno = EXCLUDED.precio_interno,
        precio_vendedores = EXCLUDED.precio_vendedores,
        updated_at = now();
    `;

    await client.query(multiRowQuery, params);
    console.log('✅ 732 variantes insertadas/actualizadas con éxito.');

    await client.query('COMMIT');
    console.log('🎉 Transacción confirmada exitosamente (COMMIT).');

    // 4. Verificación de conteo y métricas
    const countRes = await client.query('SELECT count(*) FROM public.inventario_variantes;');
    const stockRes = await client.query('SELECT count(*) as vars_con_stock, sum(stock_disponible) as total_unidades FROM public.inventario_variantes WHERE stock_disponible > 0;');
    console.log(`\n📊 RESULTADOS FINALES EN SUPABASE:`);
    console.log(`   - Total Variantes en BD: ${countRes.rows[0].count} (Esperado: 732)`);
    console.log(`   - Variantes con stock > 0: ${stockRes.rows[0].vars_con_stock}`);
    console.log(`   - Total unidades disponibles: ${stockRes.rows[0].total_unidades}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error en sincronización:', err);
  } finally {
    await client.end();
  }
}

main();
