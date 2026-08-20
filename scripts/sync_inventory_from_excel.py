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

EXCEL_PATH = r"c:\CURSOS IA\4-Stock-Zapatos\data\inventario_real.xlsx"
SHEET_NAME = "Agosto-2026"
DATA_START_ROW = 5
DATA_END_ROW   = 131

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

def parse_inventario():
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb[SHEET_NAME]

    all_rows = list(ws.iter_rows(
        min_row=DATA_START_ROW,
        max_row=DATA_END_ROW,
        values_only=True
    ))

    productos = {}
    color_entries = []

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

        if codigo is None and nombre is None and color is None:
            continue

        if codigo is not None:
            cur_cod    = str(codigo).strip()
            cur_nombre = str(nombre).strip() if nombre else cur_cod
            cur_pi     = None
            cur_pv     = None
            cur_mat    = None
            cur_taco   = None
            cur_horma  = None
            cur_info   = None

        pi = gcol(COL_P_INTERNO)
        if pi is not None:
            try: cur_pi = float(pi)
            except: pass

        pv = gcol(COL_P_VENDEDOR)
        if pv is not None:
            try: cur_pv = float(pv)
            except: pass

        mat   = gcol(COL_MATERIAL)
        if mat: cur_mat = str(mat)
        taco  = gcol(COL_TACO)
        if taco: cur_taco = str(taco)
        horma = gcol(COL_HORMA)
        if horma: cur_horma = str(horma)
        info  = gcol(COL_INFO)
        if info: cur_info = str(info)

        if not color or not cur_cod:
            continue

        color_str = str(color).strip()

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
            prod = productos[cur_cod]
            if cur_mat and not prod['material']: prod['material'] = cur_mat
            if cur_taco and not prod['taco_base']: prod['taco_base'] = cur_taco
            if cur_horma and prod['horma'] == 'Normal': prod['horma'] = cur_horma
            if cur_info and not prod['info_adicional']: prod['info_adicional'] = cur_info

        tallasMap = {}
        for talla, col_idx in TALLA_COLS.items():
            stock_val = gcol(col_idx)
            try:
                tallasMap[talla] = max(0, int(float(stock_val))) if stock_val is not None else 0
            except:
                tallasMap[talla] = 0

        color_entries.append({
            'codigo_modelo':    cur_cod,
            'color':            color_str,
            'precio_interno':   float(cur_pi) if cur_pi is not None else 0.0,
            'precio_vendedores': float(cur_pv) if cur_pv is not None else 0.0,
            'tallas':           tallasMap
        })

    return productos, color_entries

def sync_data():
    print("==========================================================")
    print("🔄 SINCRONIZACIÓN DE INVENTARIO Y CORRECCIÓN DE SKUs")
    print("==========================================================\n")
    
    productos, color_entries = parse_inventario()
    print(f"📖 Parseados {len(productos)} productos y {len(color_entries)} grupos de color ({len(color_entries) * 6} variantes totales).")

    conn = get_conn()
    print("🔌 Conectado a Supabase PostgreSQL.")

    # 1. Asegurar todos los productos existen y obtener mapa de IDs
    print("\n📦 1. Sincronizando productos...")
    producto_id_map = {}
    for cod, prod in productos.items():
        res = conn.run(
            """INSERT INTO public.productos (codigo_modelo, nombre_fantasia, material, taco_base, horma, info_adicional)
               VALUES (:cod, :nombre, :material, :taco, :horma, :info)
               ON CONFLICT (codigo_modelo) DO UPDATE SET
                   nombre_fantasia = EXCLUDED.nombre_fantasia,
                   material = COALESCE(EXCLUDED.material, productos.material),
                   taco_base = COALESCE(EXCLUDED.taco_base, productos.taco_base),
                   horma = COALESCE(EXCLUDED.horma, productos.horma),
                   info_adicional = COALESCE(EXCLUDED.info_adicional, productos.info_adicional),
                   updated_at = timezone('utc'::text, now())
               RETURNING id""",
            cod=prod['codigo_modelo'],
            nombre=prod['nombre_fantasia'],
            material=prod.get('material'),
            taco=prod.get('taco_base'),
            horma=prod.get('horma') or 'Normal',
            info=prod.get('info_adicional')
        )
        producto_id_map[cod] = res[0][0]

    print(f"✅ {len(producto_id_map)} productos sincronizados.")

    # 2. Sincronizar variantes con SKU robusto basado en color completo sanitizado
    print("\n👟 2. Sincronizando 732 variantes con SKUs inequívocos...")
    
    # Primero actualizamos los SKUs de las variantes existentes para que coincidan con la nueva convención
    # y no colisionen con los nuevos inserts.
    total_upserted = 0
    total_stock_unidades = 0
    variantes_con_stock = 0

    for entry in color_entries:
        cod = entry['codigo_modelo']
        color = entry['color']
        pi = entry['precio_interno']
        pv = entry['precio_vendedores']
        pid = producto_id_map[cod]

        # SKU sin truncar a 4 letras: sanitizado alfanumérico en mayúsculas
        color_code = re.sub(r'[^A-Za-z0-9]', '', color).upper()

        for talla, stock in entry['tallas'].items():
            sku = f"{cod}-{color_code}-{talla}"
            total_stock_unidades += stock
            if stock > 0:
                variantes_con_stock += 1

            conn.run(
                """INSERT INTO public.inventario_variantes
                   (producto_id, sku_variante, color, talla, stock_disponible, precio_interno, precio_vendedores)
                   VALUES (:pid, :sku, :color, :talla, :stock, :pi, :pv)
                   ON CONFLICT (producto_id, color, talla) DO UPDATE SET
                       sku_variante = EXCLUDED.sku_variante,
                       stock_disponible = EXCLUDED.stock_disponible,
                       precio_interno = EXCLUDED.precio_interno,
                       precio_vendedores = EXCLUDED.precio_vendedores,
                       updated_at = timezone('utc'::text, now())""",
                pid=pid,
                sku=sku,
                color=color,
                talla=talla,
                stock=stock,
                pi=pi,
                pv=pv
            )
            total_upserted += 1

    print(f"✅ Total variantes sincronizadas (upsert): {total_upserted}")
    print(f"📊 Métricas calculadas desde Excel:")
    print(f"   - Variantes con stock > 0: {variantes_con_stock}")
    print(f"   - Total unidades en bodega: {total_stock_unidades}")

    # Verificar Alicante específicamente
    print("\n🔍 Verificación de Alicante (CD0047):")
    res_ali = conn.run("""
        SELECT color, talla, stock_disponible, sku_variante
        FROM public.inventario_variantes
        WHERE producto_id = :pid
        ORDER BY color, talla;
    """, pid=producto_id_map['CD0047'])
    
    for r in res_ali:
        if r[2] > 0:
            print(f"   • Color: {r[0]:15s} | Talla {r[1]}: {r[2]} pares | SKU: {r[3]}")

if __name__ == '__main__':
    sync_data()
