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
  await client.connect();
  const trigs = await client.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'inventario_variantes';
  `);
  console.log('TRIGGERS ON inventario_variantes:', trigs.rows);

  const constrs = await client.query(`
    SELECT conname, contype, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.inventario_variantes'::regclass;
  `);
  console.log('\nCONSTRAINTS ON inventario_variantes:', constrs.rows);

  await client.end();
}

main();
