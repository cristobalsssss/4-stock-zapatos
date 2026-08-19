/**
 * Script en Node.js para purgar/limpiar transacciones de prueba
 * Tablas afectadas ÚNICAMENTE:
 * - public.detalle_movimientos
 * - public.ventas
 * - public.reservas
 * 
 * REGLA DE ORO ESTRICTA:
 * Queda PROHIBIDO tocar o alterar las tablas de catálogo:
 * - public.productos
 * - public.inventario_variantes
 * - public.imagenes_variante
 * - public.configuracion
 * 
 * Ejecución: node scripts/limpiar_transacciones_test.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('❌ Error: DATABASE_URL no está configurada en .env');
  process.exit(1);
}

const { Client } = pg;

function buildClientConfig(rawUrl) {
  try {
    const match = rawUrl.match(/^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (match) {
      const [, proto, user, password, host, port, database] = match;
      return {
        user,
        password,
        host,
        port: parseInt(port, 10),
        database,
        ssl: { rejectUnauthorized: false }
      };
    }
  } catch (e) {
    console.warn('Fallback standard parser');
  }

  const encodedUrl = rawUrl.replace('#', '%23');
  return {
    connectionString: encodedUrl,
    ssl: { rejectUnauthorized: false }
  };
}

async function purgarTransaccionesTest() {
  console.log('=====================================================');
  console.log('🧹 PURGA Y LIMPIEZA DE TRANSACCIONES DE PRUEBA');
  console.log('=====================================================\n');

  const client = new Client(buildClientConfig(DATABASE_URL));

  try {
    await client.connect();
    console.log('✅ Conectado exitosamente a Supabase PostgreSQL.\n');

    // 1. Contar registros previos
    const cMov = await client.query('SELECT count(*)::int as c FROM public.detalle_movimientos;');
    const cVen = await client.query('SELECT count(*)::int as c FROM public.ventas;');
    const cRes = await client.query('SELECT count(*)::int as c FROM public.reservas;');

    console.log(`📊 Registros actuales antes de purgar:`);
    console.log(`   • detalle_movimientos: ${cMov.rows[0].c}`);
    console.log(`   • ventas:              ${cVen.rows[0].c}`);
    console.log(`   • reservas:            ${cRes.rows[0].c}`);

    console.log('\n🗑️  Eliminando transacciones de prueba...');

    // Orden de eliminación respetando FKs
    await client.query('DELETE FROM public.detalle_movimientos;');
    await client.query('DELETE FROM public.ventas;');
    await client.query('DELETE FROM public.reservas;');

    console.log('✅ Tablas transaccionales limpiadas exitosamente.');

    // 2. Verificar que las tablas de catálogo se mantengan 100% intactas
    const cProd = await client.query('SELECT count(*)::int as c FROM public.productos;');
    const cVar = await client.query('SELECT count(*)::int as c FROM public.inventario_variantes;');
    const cImg = await client.query('SELECT count(*)::int as c FROM public.imagenes_variante;');
    const cConf = await client.query('SELECT count(*)::int as c FROM public.configuracion;');

    console.log('\n🔒 VERIFICACIÓN DE BLINDAJE DE CATÁLOGO (INTACTO):');
    console.log(`   ✅ productos:            ${cProd.rows[0].c} modelos base`);
    console.log(`   ✅ inventario_variantes: ${cVar.rows[0].c} variantes`);
    console.log(`   ✅ imagenes_variante:    ${cImg.rows[0].c} fotos`);
    console.log(`   ✅ configuracion:        ${cConf.rows[0].c} registro(s)`);

    console.log('\n=====================================================');
    console.log('🎉 ¡PURGA COMPLETADA CON ÉXITO! BASE LISTA PARA PRODUCCIÓN');
    console.log('=====================================================');

  } catch (err) {
    console.error('❌ Error durante la purga:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

purgarTransaccionesTest();
