import re
import getpass
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values


# ============================================================
# CONFIGURATION
# ============================================================

EXCEL_FILE = "COSTING.xlsx"

DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "hospital_costing"
DB_USER = "postgres"


# ============================================================
# VOLUME RANGE PARSER
# ============================================================

def parse_volume_range(value):
    """
    Converts Excel volume labels into PostgreSQL NUMRANGE.

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
    match = re.search(
        r"(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)L",
        value
    )

    if not match:
        raise ValueError(f"Invalid volume range: {value}")

    lower = float(match.group(1))
    upper = float(match.group(2))

    return f"[{lower},{upper})"


# ============================================================
# DURATION PARSER
# ============================================================

def parse_duration(value):
    """
    Extract duration from strings such as:

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


# ============================================================
# PRICING SHEET PARSER
# ============================================================

def parse_pricing_sheet(file_path, sheet_name, limb_type):

    print(f"\nReading {sheet_name} sheet...")

    df = pd.read_excel(
        file_path,
        sheet_name=sheet_name,
        header=None
    )

    records = []

    current_duration = None
    current_volume_ranges = None

    for row_index in range(len(df)):

        row = df.iloc[row_index]

        # ----------------------------------------------------
        # 1. Find duration
        # ----------------------------------------------------

        for value in row.iloc[:3]:

            duration = parse_duration(value)

            if duration is not None:

                if duration not in [7, 10, 14, 21]:
                    raise ValueError(
                        f"Unexpected duration {duration} "
                        f"in {sheet_name}, row {row_index + 1}"
                    )

                current_duration = duration

                print(
                    f"  Found {limb_type} {duration} Days "
                    f"(row {row_index + 1})"
                )

                break

        # ----------------------------------------------------
        # 2. Find volume header
        # ----------------------------------------------------

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

                    current_volume_ranges.append(
                        (
                            column_index,
                            volume_range
                        )
                    )

                except ValueError:
                    # Ignore cells that aren't volume ranges
                    continue

            print(
                f"    Found {len(current_volume_ranges)} "
                f"volume ranges"
            )

            continue

        # ----------------------------------------------------
        # 3. Find financial category rows
        # ----------------------------------------------------

        if (
            current_duration is None
            or current_volume_ranges is None
        ):
            continue

        # Financial category is in first column
        if pd.isna(first_cell):
            continue

        try:
            financial_category = int(first_cell)

        except (ValueError, TypeError):
            continue

        if financial_category not in [1, 2, 3, 4]:
            continue

        # ----------------------------------------------------
        # 4. Read rates for every volume range
        # ----------------------------------------------------

        for column_index, volume_range in current_volume_ranges:

            rate = row.iloc[column_index]

            if pd.isna(rate):
                continue

            try:
                rate = float(rate)

            except (ValueError, TypeError):
                print(
                    f"WARNING: Invalid rate at "
                    f"{sheet_name}, row {row_index + 1}, "
                    f"column {column_index + 1}"
                )
                continue

            records.append(
                (
                    limb_type,
                    current_duration,
                    volume_range,
                    financial_category,
                    rate
                )
            )

    return records


# ============================================================
# ADDITIONAL SERVICES PARSER
# ============================================================

def parse_additional_services(file_path):

    print("\nReading ADDITIONAL sheet...")

    df = pd.read_excel(
        file_path,
        sheet_name="ADDITIONAL",
        header=None
    )

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

        records.append(
            (
                service,
                cost
            )
        )

    return records


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 60)
    print("HOSPITAL COSTING - EXCEL IMPORT")
    print("=" * 60)

    # --------------------------------------------------------
    # Read Excel
    # --------------------------------------------------------

    unilateral = parse_pricing_sheet(
        EXCEL_FILE,
        "UNILATERAL",
        "UNILATERAL"
    )

    bilateral = parse_pricing_sheet(
        EXCEL_FILE,
        "BILATERAL",
        "BILATERAL"
    )

    additional = parse_additional_services(
        EXCEL_FILE
    )

    pricing_records = unilateral + bilateral

    print("\n" + "=" * 60)
    print("IMPORT SUMMARY")
    print("=" * 60)

    print(f"Unilateral records : {len(unilateral)}")
    print(f"Bilateral records  : {len(bilateral)}")
    print(f"Total pricing      : {len(pricing_records)}")
    print(f"Additional services: {len(additional)}")

    # --------------------------------------------------------
    # Ask for PostgreSQL password
    # --------------------------------------------------------

    password = getpass.getpass(
        "\nEnter PostgreSQL password: "
    )

    # --------------------------------------------------------
    # Connect to PostgreSQL
    # --------------------------------------------------------

    print("\nConnecting to PostgreSQL...")

    connection = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=password
    )

    cursor = connection.cursor()

    try:

        # ----------------------------------------------------
        # Import pricing rates
        # ----------------------------------------------------

        print("\nImporting pricing rates...")

        pricing_sql = """
            INSERT INTO pricing_rates
            (
                limb_type,
                duration_days,
                volume_range,
                financial_category,
                rate
            )
            VALUES %s

            ON CONFLICT
            (
                limb_type,
                duration_days,
                volume_range,
                financial_category
            )

            DO UPDATE SET
                rate = EXCLUDED.rate;
        """

        execute_values(
            cursor,
            pricing_sql,
            pricing_records,
            template="(%s, %s, %s::numrange, %s, %s)"
        )

        print(
            f"✓ Imported {len(pricing_records)} pricing records"
        )

        # ----------------------------------------------------
        # Import additional services
        # ----------------------------------------------------

        print("\nImporting additional services...")

        service_sql = """
            INSERT INTO additional_services
            (
                service_name,
                cost_per_day
            )

            VALUES %s

            ON CONFLICT (service_name)

            DO UPDATE SET
                cost_per_day = EXCLUDED.cost_per_day,
                active = TRUE;
        """

        execute_values(
            cursor,
            service_sql,
            additional
        )

        print(
            f"✓ Imported {len(additional)} additional services"
        )

        # ----------------------------------------------------
        # Commit
        # ----------------------------------------------------

        connection.commit()

        print("\n" + "=" * 60)
        print("IMPORT COMPLETED SUCCESSFULLY")
        print("=" * 60)

    except Exception as error:

        connection.rollback()

        print("\n IMPORT FAILED")
        print(f"Error: {error}")

        raise

    finally:

        cursor.close()
        connection.close()


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()