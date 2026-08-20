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

async function run() {
  await client.connect();
  console.log('--- 1. CONSULTANDO PRODUCTO CD0047 (ALICANTE) ---');
  const prods = await client.query("SELECT id, codigo_modelo, nombre_fantasia, material, taco_base, horma FROM productos WHERE codigo_modelo = 'CD0047'");
  console.log('PRODUCTO:', prods.rows);

  if (prods.rows.length) {
    const pid = prods.rows[0].id;
    const vars = await client.query("SELECT id, sku_variante, color, talla, stock_disponible, precio_interno, precio_vendedores FROM inventario_variantes WHERE producto_id = $1 ORDER BY color, talla", [pid]);
    console.log('\n--- 2. VARIANTES DE CD0047 EN SUPABASE (' + vars.rows.length + ' registros) ---');
    console.table(vars.rows);
  }

  await client.end();
}

run().catch(console.error);
