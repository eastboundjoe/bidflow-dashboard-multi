# processors/decompression.py
import gzip
import json
import io

def decompress_amazon_report(binary_data):
    
    # REPLACES: n8n 'Decompress Gzip' node.
    # Takes the raw binary 'blob' from Amazon and turns it into a Python list.
    
    try:
        # 1. Open the 'Gzipped' binary data
        with gzip.GzipFile(fileobj=io.BytesIO(binary_data)) as f:
            # 2. Read the decompressed text
            json_text = f.read().decode('utf-8')
            # 3. Convert text into a Python list/dictionary
            return json.loads(json_text)
    except Exception as e:
        print(f"❌ Decompression Error: {e}")
        return None

if __name__ == "__main__":
    print("🧪 This machine is ready to decompress Amazon Gzip blobs.")