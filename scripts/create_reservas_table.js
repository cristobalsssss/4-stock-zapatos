/**
 * Script en Node.js para crear la tabla 'reservas' y 'configuracion' en Supabase PostgreSQL
 * Utiliza DATABASE_URL del archivo .env
 * Ejecución: node scripts/create_reservas_table.js
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
  console.error('❌ Error: DATABASE_URL no está definida en el archivo .env');
  process.exit(1);
}

const { Client } = pg;

// Función para parsear o codificar la URL de conexión que contiene caracteres especiales como '#'
function buildClientConfig(rawUrl) {
  try {
    // Si contiene '#', codificar la contraseña
    // formato: postgresql://USER:PASS@HOST:PORT/DB
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
    console.warn('Fallback a parsing estándar');
  }

  // Si no hizo match con el regex, intentar con URL parseada o codificada
  const encodedUrl = rawUrl.replace('#', '%23');
  return {
    connectionString: encodedUrl,
    ssl: { rejectUnauthorized: false }
  };
}

async function setupReservasTable() {
  console.log('====================================================');
  console.log('🚀 CREACIÓN DE TABLA RESERVAS Y CONFIGURACIÓN EN BD');
  console.log('====================================================\n');
  console.log('📡 Conectando a Supabase PostgreSQL vía DATABASE_URL...');

  const clientConfig = buildClientConfig(DATABASE_URL);
  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Conexión establecida exitosamente con PostgreSQL.\n');

    // 1. Script SQL para la tabla 'reservas'
    const sqlReservas = `
      -- 1. Tabla de Reservas
      CREATE TABLE IF NOT EXISTS public.reservas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          codigo_reserva TEXT NOT NULL DEFAULT ('RES-' || floor(1000 + random() * 9000)::text),
          cliente_nombre TEXT NOT NULL,
          cliente_whatsapp TEXT,
          cliente_comuna TEXT,
          tipo_entrega TEXT NOT NULL DEFAULT 'Envío Starken Por Pagar',
          variante_id UUID REFERENCES public.inventario_variantes(id) ON DELETE SET NULL,
          modelo_codigo TEXT,
          modelo_nombre TEXT,
          color TEXT,
          talla TEXT,
          cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
          precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
          estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Completada', 'Cancelada')),
          notas TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
      );

      -- 2. Índices de rendimiento
      CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON public.reservas(codigo_reserva);
      CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas(estado);
      CREATE INDEX IF NOT EXISTS idx_reservas_created_at ON public.reservas(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_reservas_cliente_whatsapp ON public.reservas(cliente_whatsapp);

      -- 3. Tabla de Configuración Dinámica de Tienda
      CREATE TABLE IF NOT EXISTS public.configuracion (
          id INTEGER PRIMARY KEY DEFAULT 1,
          telefono_whatsapp TEXT DEFAULT '+56900000000',
          nombre_vendedora TEXT DEFAULT 'Carmen',
          modalidad_tienda TEXT DEFAULT 'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
          entregas_locales TEXT DEFAULT 'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
          envios_nacionales TEXT DEFAULT 'Envíos por Starken a todo Chile en modalidad "Por Pagar".',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
      );

      -- Fila por defecto en configuracion si no existe
      INSERT INTO public.configuracion (id, telefono_whatsapp, nombre_vendedora, modalidad_tienda, entregas_locales, envios_nacionales)
      VALUES (
          1,
          '+56900000000',
          'Carmen',
          'Venta 100% online, sin tienda física abierta al público. Precios de remate y liquidación de bodega hasta agotar stock.',
          'Entregas presenciales en Concepción y Penco (a coordinar con Carmen).',
          'Envíos por Starken a todo Chile en modalidad "Por Pagar".'
      )
      ON CONFLICT (id) DO NOTHING;

      -- 4. Habilitar RLS y Políticas de Acceso Público / Anon
      ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Permitir lectura publica de reservas" ON public.reservas;
      CREATE POLICY "Permitir lectura publica de reservas" ON public.reservas
          FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Permitir insercion publica de reservas" ON public.reservas;
      CREATE POLICY "Permitir insercion publica de reservas" ON public.reservas
          FOR INSERT WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir actualizacion publica de reservas" ON public.reservas;
      CREATE POLICY "Permitir actualizacion publica de reservas" ON public.reservas
          FOR UPDATE USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Permitir eliminacion de reservas" ON public.reservas;
      CREATE POLICY "Permitir eliminacion de reservas" ON public.reservas
          FOR DELETE USING (true);

      DROP POLICY IF EXISTS "Permitir lectura publica de configuracion" ON public.configuracion;
      CREATE POLICY "Permitir lectura publica de configuracion" ON public.configuracion
          FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Permitir modificacion de configuracion" ON public.configuracion;
      CREATE POLICY "Permitir modificacion de configuracion" ON public.configuracion
          FOR ALL USING (true) WITH CHECK (true);

      -- 5. Otorgar permisos a roles de Supabase (anon, authenticated, service_role)
      GRANT ALL ON public.reservas TO anon, authenticated, service_role;
      GRANT ALL ON public.configuracion TO anon, authenticated, service_role;
    `;

    console.log('⚙️  Ejecutando DDL para crear tabla public.reservas y public.configuracion...');
    await client.query(sqlReservas);
    console.log('✅ Tablas, índices, políticas RLS y permisos aplicados correctamente.\n');

    // 6. Verificar la estructura resultante de la tabla reservas
    console.log('🔍 Verificando estructura de columnas de la tabla reservas en information_schema:');
    const colsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reservas'
      ORDER BY ordinal_position;
    `);

    console.table(colsResult.rows);

    // 7. Conteo actual de reservas
    const countResult = await client.query(`SELECT count(*)::int as total FROM public.reservas;`);
    console.log(`📊 Total de registros actuales en tabla reservas: ${countResult.rows[0].total}`);

    console.log('\n====================================================');
    console.log('🎉 ¡TABLA RESERVAS CREADA Y 100% OPERATIVA EN SUPABASE!');
    console.log('====================================================');

  } catch (err) {
    console.error('❌ Error ejecutando la creación de la tabla:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupReservasTable();
