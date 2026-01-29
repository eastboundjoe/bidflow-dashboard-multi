import os
from dotenv import load_dotenv
from services.doppler_service import get_doppler_secrets
from services.auth_service import get_access_token

load_dotenv()

print("1. Checking Doppler...")
secrets = get_doppler_secrets()
if secrets:
    print(f"✅ Doppler connected. Client ID starts with: {secrets['CLIENT_ID'][:5]}...")
    os.environ["AMZ_CLIENT_ID"] = secrets["CLIENT_ID"]
    os.environ["AMZ_CLIENT_SECRET"] = secrets["CLIENT_SECRET"]
else:
    print("❌ Doppler failed.")

print("\n2. Checking Amazon Auth...")
token = get_access_token()
if token and "Error" not in token:
    print(f"✅ Amazon Token generated: {token[:10]}...")
else:
    print(f"❌ Amazon Auth failed: {token}")