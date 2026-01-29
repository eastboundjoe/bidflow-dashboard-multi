import requests
import os

def get_doppler_secrets():
    doppler_token = os.getenv("DOPPLER_TOKEN")
    
    # Target: n8n-amazon project / dev config
    url = "https://api.doppler.com/v3/configs/config/secrets/download"
    params = {"project": "n8n-amazon", "config": "dev"}
    
    headers = {
        "Authorization": f"Bearer {doppler_token}",
        "Accept": "application/json",
        "User-Agent": "BidflowEngine/1.0" # Added a User-Agent to prevent bot blocking
    }

    try:
        # verify=True is standard, but if you have a corporate firewall, 
        # it might be blocking the SSL handshake. 
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        secrets = response.json()
        
        return {
            "CLIENT_ID": secrets.get("APP_ADS_CLIENT_ID"),
            "CLIENT_SECRET": secrets.get("APP_ADS_CLIENT_SECRET")
        }
    except Exception as e:
        print(f"❌ Doppler Fetch Failed: {e}")
        return None