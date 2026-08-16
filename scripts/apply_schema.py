import sys
import io
import os
import ssl
import re
import pg8000.native

if sys.platform == "win32":
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


def parse_sql_blocks(sql_content):
    """
    Split SQL into individual executable blocks.
    Handles dollar-quoted PL/pgSQL function bodies.
    """
    blocks = []
    current = []
    in_dollar = False
    dollar_tag = ""

    for line in sql_content.split("\n"):
        stripped = line.strip()

        # Detect start/end of dollar-quoted block
        for match in re.finditer(r"\$[a-zA-Z0-9_]*\$", line):
            tag = match.group(0)
            if not in_dollar:
                in_dollar = True
                dollar_tag = tag
            elif tag == dollar_tag:
                in_dollar = False
                dollar_tag = ""

        current.append(line)

        # Statement ends at semicolon when not in dollar-quoted block
        if not in_dollar and stripped.endswith(";"):
            block = "\n".join(current).strip()
            if block:
                blocks.append(block)
            current = []

    # Handle any remaining content
    if current:
        block = "\n".join(current).strip()
        if block:
            blocks.append(block)

    return blocks


def execute_sql_file(path, conn):
    print(f"\n[SCHEMA] Reading: {path}")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    blocks = parse_sql_blocks(content)
    print(f"[SCHEMA] Parsed {len(blocks)} SQL blocks")

    ok = 0
    errors = 0
    for i, block in enumerate(blocks, start=1):
        clean = block.strip()
        if not clean or clean.startswith("--"):
            continue
        try:
            conn.run(clean)
            first = next((l.strip() for l in clean.split("\n") if l.strip() and not l.strip().startswith("--")), "")
            print(f"  [{i}/{len(blocks)}] [OK] {first[:80]}")
            ok += 1
        except Exception as e:
            first = next((l.strip() for l in clean.split("\n") if l.strip() and not l.strip().startswith("--")), "")
            err = str(e)
            # Ignore "already exists" errors for idempotency
            if "already exists" in err:
                print(f"  [{i}/{len(blocks)}] [SKIP] Already exists: {first[:60]}")
                ok += 1
            else:
                print(f"  [{i}/{len(blocks)}] [ERR] {first[:60]}")
                print(f"         Detail: {err[:120]}")
                errors += 1

    print(f"[SCHEMA] Done - OK: {ok}, Errors: {errors}")
    return errors == 0


if __name__ == "__main__":
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    schema_path = os.path.join(base, "supabase", "schema_clean.sql")

    print("[DB] Connecting to Supabase (Pooler ca-central-1)...")
    conn = get_connection()
    print("[DB] Connected successfully!")

    success = execute_sql_file(schema_path, conn)
    conn.close()

    if success:
        print("\n[DONE] Schema applied successfully!")
    else:
        print("\n[WARN] Schema applied with some errors - check output above")
