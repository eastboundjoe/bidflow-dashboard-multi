# tools/csv_tool.py
import csv
import os

def export_to_csv(data_list, filename):
    """
    TOOL: export_to_csv
    PURPOSE: Converts a list of dictionaries into a CSV file.
    SAFEGUARDS: Creates the data directory if missing; handles missing columns.
    """
    if not data_list:
        print("⚠️ No data available to export.")
        return

    # 1. Ensure the 'data' directory exists so we don't get an error
    os.makedirs('data', exist_ok=True)
    filepath = os.path.join('data', filename)

    # 2. Smart Header Logic: Find every possible column name in the data
    all_keys = set()
    for row in data_list:
        all_keys.update(row.keys())
    column_names = sorted(list(all_keys))

    # 3. Write the file
    try:
        with open(filepath, 'w', newline='', encoding='utf-8') as output_file:
            writer = csv.DictWriter(output_file, fieldnames=column_names)
            writer.writeheader()
            writer.writerows(data_list)
        print(f"📂 CSV Export Successful: {filepath}")
    except Exception as e:
        print(f"❌ Export Error: {e}")

if __name__ == "__main__":
    # Local Test
    test_data = [{"id": 1, "name": "Test"}, {"id": 2, "name": "Demo", "extra": "info"}]
    export_to_csv(test_data, "test_export.csv")