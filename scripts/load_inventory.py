import sys
import io
import os
import ssl
import re
import openpyxl
import pg8000.native

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ============================================================
# CONFIGURACION
# ============================================================
EXCEL_PATH = r"c:\CURSOS IA\4-Stock-Zapatos\data\inventario_real.xlsx"
SHEET_NAME = "Agosto-2026"
DATA_START_ROW = 5     # Row 4 = headers, Row 5 = first data row
DATA_END_ROW   = 131   # Row 132 is the totals summary row - skip it

# Columns (1-indexed)
COL_CODIGO    = 1
COL_NOMBRE    = 3
COL_P_INTERNO = 4
COL_P_VENDEDOR= 5
COL_MATERIAL  = 6
COL_TACO      = 7
COL_HORMA     = 8
COL_INFO      = 9
COL_COLOR     = 10
TALLA_COLS    = {35: 12, 36: 13, 37: 14, 38: 15, 39: 16, 40: 17}

# ============================================================
# SUPABASE CONNECTION
# ============================================================
def get_conn():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return pg8000.native.Connection(
        user="postgres.leifskqgupgsajgemgul",
        host="aws-0-ca-central-1.pooler.supabase.com",
        port=5432,
        database="postgres",
        password="Gaspi.123#2026",
        ssl_context=ctx,
        timeout=30
    )

# ============================================================
# PARSE EXCEL WITH FORWARD FILL
# ============================================================
def parse_inventario():
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[SHEET_NAME]

    all_rows = list(ws.iter_rows(
        min_row=DATA_START_ROW,
        max_row=DATA_END_ROW,
        values_only=True
    ))

    productos = {}          # codigo_modelo -> product dict
    color_entries = []      # list of {codigo_modelo, color, tallas: {35: stock, ...}, precio_interno, precio_vendedores}

    # Forward-fill state (reset on new product)
    cur_cod    = None
    cur_nombre = None
    cur_pi     = 0.0
    cur_pv     = 0.0
    cur_mat    = None
    cur_taco   = None
    cur_horma  = None
    cur_info   = None

    for row_vals in all_rows:
        def gcol(idx):
            """Get column value safely (1-indexed)."""
            try:
                v = row_vals[idx - 1]
                if isinstance(v, str):
                    v = v.strip()
                    if v == "":
                        return None
                return v
            except IndexError:
                return None

        codigo = gcol(COL_CODIGO)
        nombre = gcol(COL_NOMBRE)
        color  = gcol(COL_COLOR)

        # Detect totals row: col1 and col10 are None but talla cols have numbers
        if codigo is None and nombre is None and color is None:
            # Could be a blank row or totals - skip
            continue

        # ---- New product group ----
        if codigo is not None:
            cur_cod    = str(codigo).strip()
            cur_nombre = str(nombre).strip() if nombre else cur_cod
            # Reset product-level fields for new product
            cur_pi     = None
            cur_pv     = None
            cur_mat    = None
            cur_taco   = None
            cur_horma  = None
            cur_info   = None

        # Forward fill prices and specs within same product group
        pi = gcol(COL_P_INTERNO)
        if pi is not None:
            try:
                cur_pi = float(pi)
            except (TypeError, ValueError):
                pass

        pv = gcol(COL_P_VENDEDOR)
        if pv is not None:
            try:
                cur_pv = float(pv)
            except (TypeError, ValueError):
                pass

        mat   = gcol(COL_MATERIAL)
        if mat:
            cur_mat = str(mat)
        taco  = gcol(COL_TACO)
        if taco:
            cur_taco = str(taco)
        horma = gcol(COL_HORMA)
        if horma:
            cur_horma = str(horma)
        info  = gcol(COL_INFO)
        if info:
            cur_info = str(info)

        # Only process rows with a color
        if not color or not cur_cod:
            continue

        color_str = str(color).strip()

        # Register product if new
        if cur_cod not in productos:
            productos[cur_cod] = {
                'codigo_modelo':  cur_cod,
                'nombre_fantasia': cur_nombre or cur_cod,
                'material':       cur_mat,
                'taco_base':      cur_taco,
                'horma':          cur_horma or 'Normal',
                'info_adicional': cur_info
            }
        else:
            # Update product specs if we now have more data
            prod = productos[cur_cod]
            if cur_mat and not prod['material']:
                prod['material'] = cur_mat
            if cur_taco and not prod['taco_base']:
                prod['taco_base'] = cur_taco
            if cur_horma and prod['horma'] == 'Normal':
                prod['horma'] = cur_horma
            if cur_info and not prod['info_adicional']:
                prod['info_adicional'] = cur_info

        # Build talla stock map
        tallasMap = {}
        for talla, col_idx in TALLA_COLS.items():
            stock_val = gcol(col_idx)
            if stock_val is None:
                stock_val = 0
            try:
                tallasMap[talla] = max(0, int(float(stock_val)))
            except (TypeError, ValueError):
                tallasMap[talla] = 0

        color_entries.append({
            'codigo_modelo':    cur_cod,
            'color':            color_str,
            'precio_interno':   float(cur_pi) if cur_pi is not None else 0.0,
            'precio_vendedores': float(cur_pv) if cur_pv is not None else 0.0,
            'tallas':           tallasMap
        })

    return productos, color_entries


# ============================================================
# LOAD DATA INTO SUPABASE
# ============================================================
def load_data():
    print("[PARSE] Reading Excel inventory...")
    productos, color_entries = parse_inventario()

    total_variantes = sum(6 for _ in color_entries)  # 6 tallas per color

    print(f"[PARSE] Found {len(productos)} unique products")
    print(f"[PARSE] Found {len(color_entries)} color groups = {total_variantes} total variant-talla rows")

    print("\n[DB] Connecting to Supabase...")
    conn = get_conn()
    print("[DB] Connected!")

    # ---- Step 1: Clear existing data ----
    print("\n[STEP 1] Clearing existing data (productos, inventario_variantes)...")
    conn.run("DELETE FROM public.inventario_variantes;")
    conn.run("DELETE FROM public.productos;")
    print("[STEP 1] Done - tables cleared")

    # ---- Step 2: Insert productos ----
    print(f"\n[STEP 2] Inserting {len(productos)} products into 'productos'...")
    inserted_products = 0
    producto_id_map = {}  # codigo_modelo -> uuid

    for cod, prod in productos.items():
        try:
            result = conn.run(
                """INSERT INTO public.productos
                   (codigo_modelo, nombre_fantasia, material, taco_base, horma, info_adicional)
                   VALUES (:cod, :nombre, :material, :taco, :horma, :info)
                   RETURNING id""",
                cod=prod['codigo_modelo'],
                nombre=prod['nombre_fantasia'],
                material=prod.get('material'),
                taco=prod.get('taco_base'),
                horma=prod.get('horma') or 'Normal',
                info=prod.get('info_adicional')
            )
            producto_id_map[cod] = result[0][0]
            inserted_products += 1
        except Exception as e:
            print(f"  [ERR] Product {cod}: {e}")

    print(f"[STEP 2] Inserted {inserted_products}/{len(productos)} products OK")

    # ---- Step 3: Insert inventario_variantes ----
    print(f"\n[STEP 3] Inserting inventory variants ({total_variantes} rows)...")
    inserted_variants = 0
    skipped_variants = 0
    errors_variants = 0

    for entry in color_entries:
        cod   = entry['codigo_modelo']
        color = entry['color']
        pi    = entry['precio_interno']
        pv    = entry['precio_vendedores']

        prod_id = producto_id_map.get(cod)
        if not prod_id:
            print(f"  [WARN] No product_id for {cod} - skipping color {color}")
            skipped_variants += 6
            continue

        for talla, stock in entry['tallas'].items():
            # Generate SKU: normalize full color to uppercase alphanumeric without collisions
            color_code = re.sub(r'[^A-Za-z0-9]', '', color).upper()
            sku = f"{cod}-{color_code}-{talla}"

            try:
                conn.run(
                    """INSERT INTO public.inventario_variantes
                       (producto_id, sku_variante, color, talla, stock_disponible, precio_interno, precio_vendedores)
                       VALUES (:pid, :sku, :color, :talla, :stock, :pi, :pv)
                       ON CONFLICT (producto_id, color, talla) DO UPDATE SET
                           sku_variante     = EXCLUDED.sku_variante,
                           stock_disponible = EXCLUDED.stock_disponible,
                           precio_interno   = EXCLUDED.precio_interno,
                           precio_vendedores= EXCLUDED.precio_vendedores,
                           updated_at       = timezone('utc'::text, now())""",
                    pid=prod_id,
                    sku=sku,
                    color=color,
                    talla=talla,
                    stock=stock,
                    pi=pi,
                    pv=pv
                )
                inserted_variants += 1
            except Exception as e:
                err = str(e)
                print(f"  [ERR] Variant {sku}: {err[:100]}")
                errors_variants += 1

    print(f"[STEP 3] Variants: {inserted_variants} inserted, {skipped_variants} skipped (duplicates), {errors_variants} errors")

    # ---- Step 4: Verification query ----
    print("\n[STEP 4] Verification counts from Supabase...")
    r_prod = conn.run("SELECT COUNT(*) FROM public.productos;")
    r_var  = conn.run("SELECT COUNT(*) FROM public.inventario_variantes;")
    r_stock= conn.run("SELECT SUM(stock_disponible) FROM public.inventario_variantes;")
    r_con_stock = conn.run("SELECT COUNT(*) FROM public.inventario_variantes WHERE stock_disponible > 0;")

    conn.close()

    print(f"  - Total productos en BD:          {r_prod[0][0]}")
    print(f"  - Total variantes en BD:          {r_var[0][0]}")
    print(f"  - Variantes con stock > 0:        {r_con_stock[0][0]}")
    print(f"  - Total unidades en inventario:   {r_stock[0][0]}")

    print("\n[DONE] Inventory loaded successfully!")
    return r_prod[0][0], r_var[0][0], r_stock[0][0]


if __name__ == "__main__":
    load_data()
