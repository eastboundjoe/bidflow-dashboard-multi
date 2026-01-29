# tools/validator_tool.py
import re
from datetime import datetime

def validate_payload(payload):
 
    # REPLACES: n8n 'Extract Tenant ID' Code Node.
    # Validates that the frontend sent a real tenant_id and formats the trigger data.
 
    # Grab the body of the request (mimics n8n $input.first().json.body)
    # If payload is already the body, we use .get()
    tenant_id = payload.get('tenant_id')

    # 1. Check for missing required field
    if not tenant_id:
        raise ValueError("Missing required field: tenant_id")

    # 2. UUID validation (using the regex from your n8n node)
    uuid_regex = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    if not re.match(uuid_regex, str(tenant_id).lower()):
        raise ValueError("Invalid tenant_id format")

    # 3. Return validated and formatted data
    return {
        "tenant_id": tenant_id,
        "trigger_source": payload.get('trigger_source', 'unknown'),
        "triggered_at": payload.get('timestamp', datetime.now().isoformat())
    }

if __name__ == "__main__":
    # Test with valid and invalid data
    test_payload = {"tenant_id": "222d1d23-665b-4dbf-90d5-6db8c1900bf0"}
    try:
        print(f"🧪 Testing Validator: {validate_payload(test_payload)}")
    except ValueError as e:
        print(f"❌ Test Failed: {e}")