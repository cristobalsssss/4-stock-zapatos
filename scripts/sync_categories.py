import sys
import io
import ssl
import openpyxl
import pg8000.native

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

EXCEL_PATH = r"c:\CURSOS IA\4-Stock-Zapatos\data\inventario_real.xlsx"
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb['Agosto-2026']

# 1. Parse categories and model mappings from Excel
cat_map = {}
cur_cat = None

for row in ws.iter_rows(min_row=5, max_row=131, values_only=True):
    cat_val = str(row[0]).strip() if row[0] is not None and str(row[0]).strip() != '' else None
    cod_val = str(row[1]).strip() if row[1] is not None and str(row[1]).strip() != '' else None
    
    if cat_val is not None:
        cur_cat = cat_val
    if cod_val is not None and cur_cat is not None:
        cat_map[cod_val] = cur_cat

print(f"📖 Mapeados {len(cat_map)} modelos con su categoría desde Excel.")

# 2. Connect to Supabase
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
conn = pg8000.native.Connection(
    user="postgres.leifskqgupgsajgemgul",
    host="aws-0-ca-central-1.pooler.supabase.com",
    port=5432,
    database="postgres",
    password="Gaspi.123#2026",
    ssl_context=ctx,
    timeout=30
)

# 3. Add column categoria if not exists
print("🛠️ 1. Verificando/Agregando columna 'categoria' en public.productos...")
conn.run("ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS categoria TEXT;")
print("✅ Columna 'categoria' asegurada.")

# 4. Update each product's category
print("🔄 2. Actualizando categorías de los modelos en BD...")
updated_count = 0
for cod, cat in cat_map.items():
    conn.run(
        "UPDATE public.productos SET categoria = :cat, updated_at = now() WHERE codigo_modelo = :cod;",
        cat=cat,
        cod=cod
    )
    updated_count += 1

print(f"✅ {updated_count} modelos actualizados con su categoría.")

# 5. Verification query
res = conn.run("""
    SELECT categoria, count(*) 
    FROM public.productos 
    GROUP BY categoria 
    ORDER BY categoria;
""")
print("\n📊 DISTRIBUCIÓN DE MODELOS POR CATEGORÍA EN SUPABASE:")
for row in res:
    print(f"   • {row[0] or 'Sin Categoría'}: {row[1]} modelos")

sample = conn.run("""
    SELECT codigo_modelo, nombre_fantasia, categoria 
    FROM public.productos 
    LIMIT 10;
""")
print("\n🔍 MUESTRA DE MODELOS ACTUALIZADOS:")
for row in sample:
    print(f"   - [{row[0]}] {row[1]} -> Categoría: {row[2]}")

