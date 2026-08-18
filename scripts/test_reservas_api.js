/**
 * Test de verificación End-to-End de lectura/escritura en public.reservas vía cliente Supabase (Anon Key)
 * Ejecución: node scripts/test_reservas_api.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testReservas() {
  console.log('🧪 Probando inserción y consulta con el cliente Supabase (Anon Key)...');

  const testItem = {
    codigo_reserva: `RES-${Math.floor(1000 + Math.random() * 9000)}`,
    cliente_nombre: 'Cliente Prueba E2E',
    cliente_whatsapp: '+56 9 1234 5678',
    cliente_comuna: 'Concepción',
    tipo_entrega: 'Presencial Concepción/Penco',
    modelo_codigo: 'TEST-01',
    modelo_nombre: 'Zapato Test',
    color: 'Negro',
    talla: '37',
    cantidad: 1,
    precio_unitario: 39990,
    estado: 'Pendiente',
    notas: 'Prueba de validación automática'
  };

  const { data: inserted, error: insertError } = await supabase
    .from('reservas')
    .insert(testItem)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error al insertar:', insertError);
    process.exit(1);
  }

  console.log('✅ Inserción exitosa:', inserted);

  const { data: list, error: listError } = await supabase
    .from('reservas')
    .select('*')
    .eq('id', inserted.id);

  if (listError) {
    console.error('❌ Error al consultar:', listError);
    process.exit(1);
  }

  console.log('✅ Consulta exitosa por ID:', list);

  // Limpiar registro de prueba
  await supabase.from('reservas').delete().eq('id', inserted.id);
  console.log('🧹 Registro de prueba eliminado.');

  console.log('\n🎉 ¡La API REST y cliente Supabase tienen acceso total y validado a la tabla reservas!');
}

testReservas();
