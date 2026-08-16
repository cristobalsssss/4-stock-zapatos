/**
 * Script de verificación de Base de Datos y Storage en Supabase
 * Ejecución: node scripts/check_database.js
 */

const SUPABASE_URL = "https://leifskqgupgsajgemgul.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlaWZza3FndXBnc2FqZ2VtZ3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjgzMTMzOSwiZXhwIjoyMTAyNDA3MzM5fQ.TCj0nDmzNAanM5NKyKu3yfurkxOqPh2Qrkl9rfJZ86s";

async function checkDatabase() {
    console.log("=================================================");
    console.log("🔍 AUDITORÍA Y VERIFICACIÓN DE SUPABASE - FASE 2");
    console.log("=================================================\n");

    // 1. Verificar Buckets de Storage
    console.log("📦 1. Verificando Buckets en Supabase Storage...");
    try {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`
            }
        });
        const buckets = await res.json();
        console.log(`   ✅ Buckets encontrados (${buckets.length}):`);
        buckets.forEach(b => {
            console.log(`      - ID: ${b.id} | Nombre: ${b.name} | Público: ${b.public ? 'SÍ' : 'NO'}`);
        });
    } catch (err) {
        console.error("   ❌ Error consultando Storage:", err.message);
    }

    console.log("\n📊 2. Verificando Tablas y Endpoints REST en PostgreSQL...");
    const tables = [
        "productos",
        "inventario_variantes",
        "imagenes_variante",
        "ventas",
        "detalle_movimientos",
        "historial_precios",
        "log_busquedas_vistas"
    ];

    for (const table of tables) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Range-Unit": "items"
                }
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`   ✅ Tabla '${table}': OPERACIONAL (HTTP ${res.status}, Registros detectados: ${data.length})`);
            } else {
                console.log(`   ⏳ Tabla '${table}': Pendiente de ejecución en SQL Editor (HTTP ${res.status})`);
            }
        } catch (err) {
            console.error(`   ❌ Error en tabla '${table}':`, err.message);
        }
    }

    console.log("\n🔭 3. Verificando Vistas Analíticas...");
    const views = ["v_catalogo_resumen", "v_alertas_stock_critico", "v_resumen_vendedores"];
    for (const view of views) {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?select=*&limit=1`, {
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                console.log(`   ✅ Vista '${view}': OPERACIONAL`);
            } else {
                console.log(`   ⏳ Vista '${view}': Pendiente de creación (HTTP ${res.status})`);
            }
        } catch (err) {
            console.error(`   ❌ Error en vista '${view}':`, err.message);
        }
    }

    console.log("\n=================================================");
}

checkDatabase();
