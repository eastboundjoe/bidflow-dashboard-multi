# main.py
import os
from dotenv import load_dotenv

# --- STATION IMPORTS ---
from services.doppler_service import get_doppler_secrets  # Replaces Doppler nodes
from services.auth_service import get_access_token        # Replaces Get Access Token
from services.amazon_campaigns import get_campaigns       # Replaces HTTP Request nodes
from processors.decompression import decompress_amazon_report  # Replaces Decompress Gzip
from tools.validator_tool import validate_payload         # Replaces Extract Tenant ID
from tools.date_tool import get_report_dates              # Replaces Edit Fields node
from tools.csv_tool import export_to_csv                  # Replaces storage logic
from tools.webhook_tool import notify_frontend            # Replaces Trigger Flow 2

# Load only the DOPPLER_TOKEN from your local .env
load_dotenv()

def run_bidflow_engine(incoming_webhook_payload):
    
    # The Orchestrator:
    # Mimics the logic of your n8n flows by passing data through specialized stations.

    print("🚀 --- BIDFLOW ENGINE START ---")

    try:
        # STEP 0: VALIDATION (n8n node: Extract Tenant ID)
        # Ensures the payload has a valid UUID format before starting
        validated_data = validate_payload(incoming_webhook_payload)
        tenant_id = validated_data['tenant_id']
        print(f"✅ Payload Validated for User: {tenant_id}")

        # STEP 1: DOPPLER SECRETS (n8n node: Get Credentials Doppler)
        # Fetches CLIENT_ID and SECRET from Doppler using the token in .env
        print("🔐 Fetching secrets from Doppler Cloud...")
        secrets = get_doppler_secrets()
        
        if secrets and secrets["CLIENT_ID"]:
            # Injecting secrets into memory for this execution session
            os.environ["AMZ_CLIENT_ID"] = secrets["CLIENT_ID"]
            os.environ["AMZ_CLIENT_SECRET"] = secrets["CLIENT_SECRET"]
            print("🔑 Credentials loaded and injected successfully.")
        else:
            raise ValueError("Doppler failed to provide APP_ADS credentials.")

        # STEP 2: PREP (n8n node: Edit Fields)
        # Calculates reporting windows like 'startDate30' and 'yesterday'
        dates = get_report_dates()
        print(f"📅 Reporting Window: {dates['startDate30']} to {dates['endDate']}")

        # STEP 3: AUTH (n8n node: Get Access Token)
        # Uses the injected Doppler secrets to get a fresh Amazon token
        token = get_access_token()
        if not token or "Error" in token:
            print("❌ Authentication failed at Amazon.")
            notify_frontend(tenant_id, "failed", "Auth Error")
            return

        # STEP 4: FETCH (n8n node: HTTP Request)
        # Replaces the logic to pull data from Amazon Advertising API
        US_PROFILE_ID = "1279339718510959" # (Hardcoded for now, can move to credentials table later)
        print("📡 Fetching data from Amazon...")
        raw_data = get_campaigns(token, US_PROFILE_ID)

        # STEP 5: REFINERY (n8n node: Decompress Gzip)
        # Smart check: only decompresses if Amazon sends binary Gzip data
        if isinstance(raw_data, bytes):
            print("📦 Decompressing Gzip report...")
            processed_data = decompress_amazon_report(raw_data)
        else:
            processed_data = raw_data

        # STEP 6: STORAGE & CALLBACK (n8n nodes: Supabase/Webhooks)
        # Saves data locally and pings your website that the job is done
        if isinstance(processed_data, list):
            filename = f"sync_{tenant_id}_{dates['today']}.csv"
            export_to_csv(processed_data, filename)
            
            # Final Success Signal back to your frontend
            notify_frontend(
                tenant_id, 
                "success", 
                "Sync complete", 
                {"count": len(processed_data)}
            )
            print(f"🏁 Sync successful for {tenant_id}")
        else:
            raise ValueError("Data format invalid after processing.")

    except Exception as e:
        # Centralized error handler replacing n8n error lines
        error_msg = str(e)
        print(f"❌ Engine Error: {error_msg}")
        # Attempt to notify the frontend even on failure
        notify_frontend("unknown", "failed", error_msg)

if __name__ == "__main__":
    # Simulate a trigger from your Vercel frontend
    mock_payload = {
        "tenant_id": "222d1d23-665b-4dbf-90d5-6db8c1900bf0",
        "trigger_source": "bidflow_ui",
        "timestamp": "2025-12-28T12:12:09.388Z"
    }
    
    run_bidflow_engine(mock_payload)