import os
import sys
import ssl
import re
import pg8000.native

# Set UTF-8 encoding for stdout on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

def get_connection():
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

def parse_sql_statements(sql_content):
    statements = []
    current_stmt = []
    in_dollar_quote = False
    dollar_tag = ""

    lines = sql_content.split("\n")
    for line in lines:
        stripped = line.strip()
        
        # Check for dollar quoting (PL/pgSQL functions / DO blocks)
        dollar_matches = re.findall(r"\$[a-zA-Z0-9_]*\$", line)
        for dm in dollar_matches:
            if not in_dollar_quote:
                in_dollar_quote = True
                dollar_tag = dm
            elif dm == dollar_tag:
                in_dollar_quote = False
                dollar_tag = ""

        current_stmt.append(line)

        if not in_dollar_quote and stripped.endswith(";"):
            full_stmt = "\n".join(current_stmt).strip()
            if full_stmt:
                statements.append(full_stmt)
            current_stmt = []

    if current_stmt:
        remaining = "\n".join(current_stmt).strip()
        if remaining:
            statements.append(remaining)

    return statements

def run_sql_file(file_path):
    print(f"\n[FILE] Leyendo archivo SQL: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    conn = get_connection()
    print("[DB] Conexion establecida con PostgreSQL (Supabase).")

    statements = parse_sql_statements(sql_content)
    print(f"[SQL] Ejecutando {len(statements)} bloques SQL...")

    for idx, stmt in enumerate(statements, start=1):
        clean_stmt = stmt.strip()
        if not clean_stmt or clean_stmt.startswith("--"):
            continue
        try:
            conn.run(clean_stmt)
            first_line = [l.strip() for l in clean_stmt.split("\n") if l.strip() and not l.strip().startswith("--")][0]
            print(f"  [{idx}/{len(statements)}] [OK] {first_line[:75]}")
        except Exception as e:
            print(f"  [{idx}/{len(statements)}] [WARN] Error en bloque:\n      {clean_stmt[:90]}...\n      Detalle: {e}")

    conn.close()
    print(f"[DONE] Finalizada ejecucion de {file_path}.")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    schema_path = os.path.join(base_dir, "supabase", "schema.sql")
    seed_path = os.path.join(base_dir, "supabase", "seed.sql")

    run_sql_file(schema_path)
    if os.path.exists(seed_path):
        run_sql_file(seed_path)
