import openpyxl
import re

EXCEL_PATH = r"c:\CURSOS IA\4-Stock-Zapatos\data\inventario_real.xlsx"
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb['Agosto-2026']

all_rows = list(ws.iter_rows(min_row=5, max_row=131, values_only=True))

cur_cod = None
cur_nombre = None
color_entries = []

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
    
    tallas_dict = {}
    for talla, col_idx in {35: 12, 36: 13, 37: 14, 38: 15, 39: 16, 40: 17}.items():
        v = gcol(col_idx)
        try:
            tallas_dict[talla] = int(float(v)) if v is not None else 0
        except:
            tallas_dict[talla] = 0

    color_entries.append({
        'row_idx': row_idx,
        'codigo_modelo': cur_cod,
        'nombre_fantasia': cur_nombre,
        'color': color_str,
        'tallas': tallas_dict
    })

print(f"Total filas de color en Excel: {len(color_entries)}")

# 1. Chequear colisiones de los 4 primeros caracteres en SKU
sku_4_map = {}
collisions_4 = []

for entry in color_entries:
    cod = entry['codigo_modelo']
    color = entry['color']
    color_code_4 = re.sub(r'[^A-Za-z0-9]', '', color)[:4].upper()
    key = (cod, color_code_4)
    if key in sku_4_map:
        collisions_4.append((sku_4_map[key], entry))
    else:
        sku_4_map[key] = entry

print(f"\n--- COLISIONES DETECTADAS CON TRUNCADO A 4 CARACTERES ({len(collisions_4)} modelos afectados) ---")
for orig, dup in collisions_4:
    print(f"Modelo: {orig['codigo_modelo']} ({orig['nombre_fantasia']})")
    print(f"  - Color 1 (Fila {orig['row_idx']}): '{orig['color']}' -> Tallas: {orig['tallas']}")
    print(f"  - Color 2 (Fila {dup['row_idx']}): '{dup['color']}' -> Tallas: {dup['tallas']}")
    print()

