import openpyxl
import ssl
import pg8000.native

# Connect to DB
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

# Fetch all DB variants
db_rows = conn.run("""
    SELECT p.codigo_modelo, p.nombre_fantasia, v.color, v.talla, v.stock_disponible, v.sku_variante
    FROM inventario_variantes v
    JOIN productos p ON p.id = v.producto_id
    ORDER BY p.codigo_modelo, v.color, v.talla;
""")

db_map = {}
for cod, nom, col, tal, stock, sku in db_rows:
    db_map[(cod, col.strip().lower(), tal)] = {
        'cod': cod,
        'nom': nom,
        'color': col,
        'talla': tal,
        'stock': stock,
        'sku': sku
    }

# Read Excel
wb = openpyxl.load_workbook(r"c:\CURSOS IA\4-Stock-Zapatos\data\inventario_real.xlsx", data_only=True)
ws = wb['Agosto-2026']

all_rows = list(ws.iter_rows(min_row=5, max_row=131, values_only=True))

cur_cod = None
cur_nombre = None
excel_entries = []

for row_idx, row_vals in enumerate(all_rows, start=5):
    def gcol(idx):
        try:
            v = row_vals[idx - 1]
            if isinstance(v, str):
                v = v.strip()
                if v == "": return None
            return v
        except:
            return None

    codigo = gcol(1)
    nombre = gcol(3)
    color = gcol(10)

    if codigo is not None:
        cur_cod = str(codigo).strip()
        cur_nombre = str(nombre).strip() if nombre else cur_cod

    if not color or not cur_cod:
        continue

    color_str = str(color).strip()
    
    for talla, col_idx in {35: 12, 36: 13, 37: 14, 38: 15, 39: 16, 40: 17}.items():
        v = gcol(col_idx)
        try:
            st = int(float(v)) if v is not None else 0
        except:
            st = 0
        excel_entries.append({
            'row_idx': row_idx,
            'cod': cur_cod,
            'nom': cur_nombre,
            'color': color_str,
            'talla': talla,
            'stock': st
        })

print(f"Total registros en Excel (variante-talla): {len(excel_entries)}")
print(f"Total registros en Supabase: {len(db_rows)}")

# Find missing in DB
missing_in_db = []
stock_mismatches = []

for e in excel_entries:
    key = (e['cod'], e['color'].lower(), e['talla'])
    if key not in db_map:
        missing_in_db.append(e)
    else:
        db_item = db_map[key]
        if db_item['stock'] != e['stock']:
            stock_mismatches.append({
                'excel': e,
                'db_stock': db_item['stock'],
                'db_color': db_item['color'],
                'sku': db_item['sku']
            })

print(f"\n--- VARIANTES EN EXCEL QUE NO EXISTEN EN LA BD ({len(missing_in_db)} registros) ---")
for m in missing_in_db:
    if m['stock'] > 0: # highlight with stock
        print(f"  [CON STOCK > 0] Fila {m['row_idx']}: {m['cod']} ({m['nom']}) | Color: '{m['color']}' | Talla: {m['talla']} | Stock Excel: {m['stock']}")
    else:
        print(f"  [Stock 0] Fila {m['row_idx']}: {m['cod']} ({m['nom']}) | Color: '{m['color']}' | Talla: {m['talla']} | Stock Excel: {m['stock']}")

print(f"\n--- DISCREPANCIAS DE STOCK ENTRE EXCEL Y BD ({len(stock_mismatches)} registros) ---")
for s in stock_mismatches:
    e = s['excel']
    print(f"  Fila {e['row_idx']}: {e['cod']} ({e['nom']}) | Color: '{e['color']}' | Talla: {e['talla']} -> Excel Stock: {e['stock']} vs DB Stock: {s['db_stock']} (SKU: {s['sku']})")

