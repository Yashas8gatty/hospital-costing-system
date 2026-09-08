import argparse
import decimal
from decimal import Decimal
import getpass
import os
import re
import sys
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values


# Force UTF-8 output formatting if supported
if hasattr(sys.stdout, "reconfigure"):
  try:
    sys.stdout.reconfigure(encoding="utf-8")
  except Exception:
    pass


# ============================================================
# 1. LOAD ENVIRONMENT VARIABLES FROM backend/.env
# ============================================================
def load_env():
  env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
  if os.path.exists(env_path):
    with open(env_path, "r", encoding="utf-8") as f:
      for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
          key, val = line.split("=", 1)
          if key.strip() not in os.environ:
            os.environ[key.strip()] = val.strip()


load_env()

DEFAULT_EXCEL_FILE = "COSTING.xlsx"


# ============================================================
# 2. NUMRANGE PARSER & NORMALIZATION
# ============================================================
def parse_volume_range(value):
  """Converts Excel volume labels into PostgreSQL NUMRANGE string format.

  Examples:
      < 2L     -> [0,2)
      2 - 3L   -> [2,3)
      3-4L     -> [3,4)
  """
  value = str(value).strip().replace(" ", "")

  # Example: <2L
  if value.startswith("<"):
    match = re.search(r"<(\d+(?:\.\d+)?)L", value)
    if not match:
      raise ValueError(f"Invalid volume range: {value}")
    upper = float(match.group(1))
    return f"[0,{upper})"

  # Example: 2-3L
  match = re.search(r"(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)L", value)
  if not match:
    raise ValueError(f"Invalid volume range: {value}")

  lower = float(match.group(1))
  upper = float(match.group(2))
  return f"[{lower},{upper})"


def normalize_numrange(val_str):
  """Parses a NUMRANGE string into a canonical float-tuple for robust comparison.

  Example:
      "[0, 2.0)" -> (0.0, 2.0, True, False)
  """
  val_str = str(val_str).strip().replace(" ", "")
  match = re.match(
      r"^([\[\(])\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*([\]\)])$", val_str
  )
  if not match:
    raise ValueError(f"Invalid numrange format: {val_str}")
  lower_inc = match.group(1) == "["
  lower_val = float(match.group(2))
  upper_val = float(match.group(3))
  upper_inc = match.group(4) == "]"
  return (lower_val, upper_val, lower_inc, upper_inc)


# ============================================================
# 3. DURATION & EXCEL SHEET PARSERS
# ============================================================
def parse_duration(value):
  """Extract duration from strings such as:

  LF UL 7 Days
  LF UL 10 Days
  LF BL 14 Days
  LF BL 21 Days
  """
  if pd.isna(value):
    return None
  value = str(value)
  match = re.search(r"(\d+)\s*Days", value)
  if not match:
    return None
  return int(match.group(1))


def parse_pricing_sheet(file_path, sheet_name, limb_type):
  print(f"\nReading {sheet_name} sheet...")
  df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)

  records = []
  current_duration = None
  current_volume_ranges = None

  for row_index in range(len(df)):
    row = df.iloc[row_index]

    # Find duration
    for value in row.iloc[:3]:
      duration = parse_duration(value)
      if duration is not None:
        if duration not in [7, 10, 14, 21]:
          raise ValueError(
              f"Unexpected duration {duration} in {sheet_name}, row"
              f" {row_index + 1}"
          )
        current_duration = duration
        print(f"  Found {limb_type} {duration} Days (row {row_index + 1})")
        break

    # Find volume header
    first_cell = row.iloc[0]
    if (
        not pd.isna(first_cell)
        and str(first_cell).strip().lower() == "limb size"
    ):
      current_volume_ranges = []
      for column_index in range(1, len(df.columns)):
        value = row.iloc[column_index]
        if pd.isna(value):
          continue
        value = str(value).strip()
        try:
          volume_range = parse_volume_range(value)
          current_volume_ranges.append((column_index, volume_range))
        except ValueError:
          continue
      print(f"    Found {len(current_volume_ranges)} volume ranges")
      continue

    # Read financial category rows
    if current_duration is None or current_volume_ranges is None:
      continue
    if pd.isna(first_cell):
      continue

    try:
      financial_category = int(first_cell)
    except (ValueError, TypeError):
      continue

    if financial_category not in [1, 2, 3, 4]:
      continue

    # Read rates for every volume range
    for column_index, volume_range in current_volume_ranges:
      rate = row.iloc[column_index]
      if pd.isna(rate):
        continue
      try:
        rate = float(rate)
      except (ValueError, TypeError):
        print(
            f"WARNING: Invalid rate at {sheet_name}, row {row_index + 1},"
            f" column {column_index + 1}"
        )
        continue

      records.append((
          limb_type,
          current_duration,
          volume_range,
          financial_category,
          rate,
      ))

  return records


def parse_additional_services(file_path):
  print("\nReading ADDITIONAL sheet...")
  df = pd.read_excel(file_path, sheet_name="ADDITIONAL", header=None)

  records = []
  for row_index in range(len(df)):
    service = df.iloc[row_index, 1]
    cost = df.iloc[row_index, 2]

    if pd.isna(service) or pd.isna(cost):
      continue

    service = str(service).strip()
    if service.upper() == "SERVICES":
      continue

    try:
      cost = float(cost)
    except (ValueError, TypeError):
      continue

    records.append((service, cost))

  return records


# ============================================================
# 4. DATA VALIDATION (BEFORE DB CONNECTION)
# ============================================================
def validate_data(pricing_records, service_records):
  errors = []

  # Validate pricing records
  seen_pricing_keys = {}
  for idx, rec in enumerate(pricing_records):
    limb, dur, vol_range, fin_cat, rate = rec

    if limb not in ["UNILATERAL", "BILATERAL"]:
      errors.append(f'Pricing row {idx}: Invalid limb_type "{limb}"')
    if dur not in [7, 10, 14, 21]:
      errors.append(f"Pricing row {idx}: Invalid duration_days {dur}")
    if fin_cat not in [1, 2, 3, 4]:
      errors.append(f"Pricing row {idx}: Invalid financial_category {fin_cat}")
    if not isinstance(rate, (int, float)) or rate < 0:
      errors.append(f"Pricing row {idx}: Invalid rate {rate}")

    try:
      norm_vol = normalize_numrange(vol_range)
    except Exception as e:
      errors.append(
          f'Pricing row {idx}: Invalid volume_range "{vol_range}": {e}'
      )
      norm_vol = None

    if norm_vol is not None:
      key = (limb, dur, norm_vol, fin_cat)
      if key in seen_pricing_keys:
        errors.append(
            f"Duplicate pricing key in Excel: {limb}, {dur} days, {vol_range},"
            f" Category {fin_cat} (Conflict between record #{seen_pricing_keys[key] + 1} and #{idx + 1})"
        )
      else:
        seen_pricing_keys[key] = idx

  # Validate service records
  seen_services = {}
  for idx, rec in enumerate(service_records):
    name, cost = rec

    if not name or not str(name).strip():
      errors.append(f"Service row {idx}: Empty service_name")
    if not isinstance(cost, (int, float)) or cost < 0:
      errors.append(f"Service row {idx}: Invalid cost_per_day {cost}")

    name_clean = str(name).strip().upper()
    if name_clean in seen_services:
      errors.append(
          f'Duplicate service name in Excel: "{name}" (Conflict between record'
          f' #{seen_services[name_clean] + 1} and #{idx + 1})'
      )
    else:
      seen_services[name_clean] = idx

  if errors:
    print("\n" + "=" * 60)
    print("EXCEL VALIDATION FAILED")
    print("=" * 60)
    for err in errors:
      print(f"  [ERROR] {err}")
    print("\nAborting synchronization. Zero database changes were made.")
    sys.exit(1)

  print("[OK] Excel data validation PASSED (0 errors)")


# ============================================================
# 5. SYNCHRONIZATION & POST-IMPORT VERIFICATION
# ============================================================
def synchronize(
    connection, pricing_records, service_records, dry_run=False, auto_yes=False
):
  cursor = connection.cursor()

  try:
    # --------------------------------------------------------
    # A. Fetch & Categorize Pricing Records
    # --------------------------------------------------------
    cursor.execute("""
            SELECT id, limb_type, duration_days, volume_range::text, financial_category, rate
            FROM pricing_rates
        """)
    db_pricing_rows = cursor.fetchall()

    db_pricing_map = {}
    for row in db_pricing_rows:
      p_id, limb, dur, vol_str, fin_cat, rate = row
      norm_vol = normalize_numrange(vol_str)
      key = (limb, dur, norm_vol, fin_cat)
      db_pricing_map[key] = {
          "id": p_id,
          "limb": limb,
          "dur": dur,
          "vol_str": vol_str,
          "fin_cat": fin_cat,
          "rate": Decimal(str(rate)),
      }

    pricing_inserted = []
    pricing_updated = []
    pricing_unchanged = []
    matched_db_pricing_ids = set()

    for rec in pricing_records:
      limb, dur, vol_str, fin_cat, rate = rec
      excel_rate = Decimal(str(rate)).quantize(Decimal("0.01"))
      norm_vol = normalize_numrange(vol_str)
      key = (limb, dur, norm_vol, fin_cat)

      if key in db_pricing_map:
        db_rec = db_pricing_map[key]
        matched_db_pricing_ids.add(db_rec["id"])
        db_rate = db_rec["rate"].quantize(Decimal("0.01"))
        if db_rate != excel_rate:
          pricing_updated.append(
              (db_rec["id"], limb, dur, vol_str, fin_cat, excel_rate, db_rate)
          )
        else:
          pricing_unchanged.append(rec)
      else:
        pricing_inserted.append((limb, dur, vol_str, fin_cat, excel_rate))

    obsolete_db_pricing = [
        db_rec
        for key, db_rec in db_pricing_map.items()
        if db_rec["id"] not in matched_db_pricing_ids
    ]

    # --------------------------------------------------------
    # B. Fetch & Categorize Additional Services
    # --------------------------------------------------------
    cursor.execute("""
            SELECT id, service_name, cost_per_day, active
            FROM additional_services
        """)
    db_services_rows = cursor.fetchall()

    db_services_map = {}
    for row in db_services_rows:
      s_id, s_name, s_cost, active = row
      db_services_map[s_name.strip()] = {
          "id": s_id,
          "service_name": s_name.strip(),
          "cost_per_day": Decimal(str(s_cost)),
          "active": active,
      }

    services_inserted = []
    services_updated = []
    services_unchanged = []
    matched_db_service_names = set()

    for rec in service_records:
      s_name, s_cost = rec
      s_name = s_name.strip()
      excel_cost = Decimal(str(s_cost)).quantize(Decimal("0.01"))
      matched_db_service_names.add(s_name)

      if s_name in db_services_map:
        db_srv = db_services_map[s_name]
        db_cost = db_srv["cost_per_day"].quantize(Decimal("0.01"))
        db_active = db_srv["active"]
        if db_cost != excel_cost or not db_active:
          services_updated.append((db_srv["id"], s_name, excel_cost, db_srv))
        else:
          services_unchanged.append(rec)
      else:
        services_inserted.append((s_name, excel_cost))

    services_to_deactivate = [
        db_srv
        for name, db_srv in db_services_map.items()
        if name not in matched_db_service_names and db_srv["active"]
    ]

    # --------------------------------------------------------
    # C. Display Summary Breakdown
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    if dry_run:
      print("DRY RUN SYNCHRONIZATION SUMMARY")
    else:
      print("EXCEL DATABASE SYNCHRONIZATION SUMMARY")
    print("=" * 60)

    print("\nPricing:")
    print(f"  Excel records: {len(pricing_records)}")
    print(f"  New:           {len(pricing_inserted)}")
    print(f"  Updated:       {len(pricing_updated)}")
    print(f"  Unchanged:     {len(pricing_unchanged)}")
    print(f"  Obsolete:      {len(obsolete_db_pricing)}")

    print("\nAdditional Services:")
    print(f"  Excel records: {len(service_records)}")
    print(f"  New:           {len(services_inserted)}")
    print(f"  Updated:       {len(services_updated)}")
    print(f"  Deactivated:   {len(services_to_deactivate)}")

    # DRY RUN TERMINATION
    if dry_run:
      connection.rollback()
      print("\nDatabase changes: NONE (DRY RUN MODE)")
      print("Transaction: ROLLED BACK")
      print("=" * 60)
      return

    # User Confirmation Prompt
    if not auto_yes:
      confirm = (
          input("\nProceed with synchronization? [y/N]: ").strip().lower()
      )
      if confirm not in ["y", "yes"]:
        connection.rollback()
        print("\nSynchronization cancelled by user.")
        print("Transaction: ROLLED BACK")
        sys.exit(0)

    # --------------------------------------------------------
    # D. Execute Database Updates (Inside Single Transaction)
    # --------------------------------------------------------
    # 1. Upsert Pricing Rates
    if pricing_records:
      pricing_upsert_sql = """
                INSERT INTO pricing_rates (limb_type, duration_days, volume_range, financial_category, rate)
                VALUES %s
                ON CONFLICT (limb_type, duration_days, volume_range, financial_category)
                DO UPDATE SET rate = EXCLUDED.rate;
            """
      pricing_tuples = [(r[0], r[1], r[2], r[3], r[4]) for r in pricing_records]
      execute_values(
          cursor,
          pricing_upsert_sql,
          pricing_tuples,
          template="(%s, %s, %s::numrange, %s, %s)",
      )

    # 2. Delete Obsolete Pricing Records
    if obsolete_db_pricing:
      obsolete_ids = [r["id"] for r in obsolete_db_pricing]
      cursor.execute(
          "DELETE FROM pricing_rates WHERE id = ANY(%s);", (obsolete_ids,)
      )

    # 3. Upsert Additional Services
    if service_records:
      service_upsert_sql = """
                INSERT INTO additional_services (service_name, cost_per_day, active)
                VALUES %s
                ON CONFLICT (service_name)
                DO UPDATE SET cost_per_day = EXCLUDED.cost_per_day, active = TRUE;
            """
      service_tuples = [(r[0], r[1], True) for r in service_records]
      execute_values(cursor, service_upsert_sql, service_tuples)

    # 4. Deactivate Removed Additional Services
    if services_to_deactivate:
      deactivate_ids = [r["id"] for r in services_to_deactivate]
      cursor.execute(
          "UPDATE additional_services SET active = FALSE WHERE id = ANY(%s);",
          (deactivate_ids,),
      )

    # --------------------------------------------------------
    # E. Post-Import Verification (Before Commit)
    # --------------------------------------------------------
    # 1. Verify Pricing Count
    cursor.execute("SELECT count(*) FROM pricing_rates")
    final_pricing_count = cursor.fetchone()[0]
    if final_pricing_count != len(pricing_records):
      raise ValueError(
          f"Post-import verification failed: DB pricing count"
          f" ({final_pricing_count}) != Excel count ({len(pricing_records)})"
      )

    # 2. Verify Every Pricing Record & Rate
    for rec in pricing_records:
      limb, dur, vol_str, fin_cat, rate = rec
      cursor.execute(
          """
                SELECT rate FROM pricing_rates
                WHERE limb_type = %s AND duration_days = %s AND financial_category = %s AND volume_range = %s::numrange
            """,
          (limb, dur, fin_cat, vol_str),
      )
      db_row = cursor.fetchone()
      if not db_row:
        raise ValueError(
            f"Post-import verification failed: Missing pricing key ({limb},"
            f" {dur}, {vol_str}, {fin_cat})"
        )
      db_rate = Decimal(str(db_row[0])).quantize(Decimal("0.01"))
      ex_rate = Decimal(str(rate)).quantize(Decimal("0.01"))
      if db_rate != ex_rate:
        raise ValueError(
            f"Post-import verification failed: Rate mismatch for key ({limb},"
            f" {dur}, {vol_str}, {fin_cat}): DB {db_rate} != Excel {ex_rate}"
        )

    # 3. Verify Additional Services
    for s_name, s_cost in service_records:
      s_name = s_name.strip()
      cursor.execute(
          """
                SELECT cost_per_day, active FROM additional_services WHERE service_name = %s
            """,
          (s_name,),
      )
      srv_row = cursor.fetchone()
      if not srv_row or not srv_row[1]:
        raise ValueError(
            f'Post-import verification failed: Service "{s_name}" missing or'
            " not active in DB"
        )
      db_cost = Decimal(str(srv_row[0])).quantize(Decimal("0.01"))
      ex_cost = Decimal(str(s_cost)).quantize(Decimal("0.01"))
      if db_cost != ex_cost:
        raise ValueError(
            f'Post-import verification failed: Cost mismatch for service'
            f' "{s_name}": DB {db_cost} != Excel {ex_cost}'
        )

    # 4. Verify Unintended Active Services
    excel_service_names = [r[0].strip() for r in service_records]
    cursor.execute(
        """
            SELECT count(*) FROM additional_services WHERE active = TRUE AND NOT (service_name = ANY(%s))
        """,
        (excel_service_names,),
    )
    unintended_active_services = cursor.fetchone()[0]
    if unintended_active_services > 0:
      raise ValueError(
          "Post-import verification failed: Found active services in DB that"
          " are missing from Excel"
      )

    # --------------------------------------------------------
    # F. Commit Transaction
    # --------------------------------------------------------
    connection.commit()

    print("\n" + "=" * 60)
    print("IMPORT COMPLETED SUCCESSFULLY")
    print("=" * 60)

    print("\nPricing:")
    print(f"  Excel records: {len(pricing_records)}")
    print(f"  Inserted:      {len(pricing_inserted)}")
    print(f"  Updated:       {len(pricing_updated)}")
    print(f"  Unchanged:     {len(pricing_unchanged)}")
    print(f"  Removed:       {len(obsolete_db_pricing)}")

    print("\nAdditional Services:")
    print(f"  Excel records: {len(service_records)}")
    print(f"  Inserted:      {len(services_inserted)}")
    print(f"  Updated:       {len(services_updated)}")
    print(f"  Deactivated:   {len(services_to_deactivate)}")

    print("\nDatabase synchronization: VERIFIED")
    print("Transaction: COMMITTED")
    print("=" * 60)

  except Exception as e:
    connection.rollback()
    print("\n" + "=" * 60)
    print("IMPORT FAILED")
    print("=" * 60)
    print(f"\nReason: {e}")
    print("\nDatabase transaction: ROLLED BACK")
    print("No partial changes were committed.")
    print("=" * 60)
    sys.exit(1)
  finally:
    cursor.close()


# ============================================================
# 6. MAIN & CLI ARGUMENT PARSER
# ============================================================
def main():
  parser = argparse.ArgumentParser(
      description=(
          "Safe, repeatable Excel-to-PostgreSQL pricing and services"
          " synchronization tool."
      )
  )
  parser.add_argument(
      "--dry-run",
      action="store_true",
      help=(
          "Simulate synchronization, report proposed changes, and rollback"
          " without writing to database."
      ),
  )
  parser.add_argument(
      "-y",
      "--yes",
      action="store_true",
      help="Skip interactive confirmation prompt and commit changes if verified.",
  )
  parser.add_argument(
      "--excel",
      default=DEFAULT_EXCEL_FILE,
      help=f'Path to the Excel costing file (default: "{DEFAULT_EXCEL_FILE}").',
  )

  args = parser.parse_args()
  excel_file = args.excel

  print("=" * 60)
  print("HOSPITAL COSTING - EXCEL SYNCHRONIZER")
  print("=" * 60)

  if not os.path.exists(excel_file):
    print(f'\nERROR: Excel file "{excel_file}" not found!')
    sys.exit(1)

  # --------------------------------------------------------
  # Parse Excel
  # --------------------------------------------------------
  unilateral = parse_pricing_sheet(excel_file, "UNILATERAL", "UNILATERAL")
  bilateral = parse_pricing_sheet(excel_file, "BILATERAL", "BILATERAL")
  additional = parse_additional_services(excel_file)
  pricing_records = unilateral + bilateral

  print("\n" + "=" * 60)
  print("PARSED EXCEL SUMMARY")
  print("=" * 60)
  print(f"Unilateral records : {len(unilateral)}")
  print(f"Bilateral records  : {len(bilateral)}")
  print(f"Total pricing      : {len(pricing_records)}")
  print(f"Additional services: {len(additional)}")

  # --------------------------------------------------------
  # Validate Excel Data
  # --------------------------------------------------------
  validate_data(pricing_records, additional)

  # --------------------------------------------------------
  # Database Connection Setup
  # --------------------------------------------------------
  db_host = os.environ.get("DB_HOST", "localhost")
  db_port = os.environ.get("DB_PORT", "5432")
  db_name = os.environ.get("DB_NAME", "hospital_costing")
  db_user = os.environ.get("DB_USER", "postgres")
  db_password = os.environ.get("DB_PASSWORD")

  if db_password is None:
    if not args.yes and not args.dry_run and sys.stdin.isatty():
      db_password = getpass.getpass("\nEnter PostgreSQL password: ")
    else:
      db_password = ""

  print("\nConnecting to PostgreSQL...")
  try:
    connection = psycopg2.connect(
        host=db_host,
        port=db_port,
        database=db_name,
        user=db_user,
        password=db_password,
    )
    connection.autocommit = False
  except Exception as err:
    print(f"\nERROR: Failed to connect to PostgreSQL: {err}")
    sys.exit(1)

  try:
    synchronize(
        connection,
        pricing_records,
        additional,
        dry_run=args.dry_run,
        auto_yes=args.yes,
    )
  finally:
    connection.close()


if __name__ == "__main__":
  main()