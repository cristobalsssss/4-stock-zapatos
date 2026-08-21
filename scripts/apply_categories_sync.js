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
  console.log('🚀 Sincronizando categorías en Supabase...');
  const catMap = JSON.parse(fs.readFileSync('data/categories_map.json', 'utf8'));

  await client.connect();
  console.log('🔌 Conectado a PostgreSQL.');

  // 1. Agregar columna si no existe
  await client.query('ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS categoria TEXT;');
  console.log("✅ Columna 'categoria' asegurada en public.productos.");

  // 2. Construir update en lote usando VALUES (...)
  const entries = Object.entries(catMap);
  const valClauses = [];
  const params = [];
  let pIdx = 1;

  for (const [cod, cat] of entries) {
    valClauses.push(`($${pIdx}::text, $${pIdx+1}::text)`);
    params.push(cod, cat);
    pIdx += 2;
  }

  const updateQuery = `
    UPDATE public.productos AS p
    SET categoria = c.cat,
        updated_at = now()
    FROM (VALUES ${valClauses.join(', ')}) AS c(cod, cat)
    WHERE p.codigo_modelo = c.cod;
  `;

  const res = await client.query(updateQuery, params);
  console.log(`✅ ${res.rowCount} productos actualizados con su categoría.`);

  // 3. Resumen por categoría
  const summary = await client.query(`
    SELECT categoria, count(*) as total_modelos
    FROM public.productos
    GROUP BY categoria
    ORDER BY total_modelos DESC;
  `);
  console.log('\n📊 DISTRIBUCIÓN DE MODELOS POR CATEGORÍA:');
  console.table(summary.rows);

  // 4. Muestra de productos
  const sample = await client.query(`
    SELECT codigo_modelo, nombre_fantasia, categoria
    FROM public.productos
    LIMIT 10;
  `);
  console.log('\n🔍 MUESTRA:');
  console.table(sample.rows);

  await client.end();
}

main().catch(console.error);
