import requests
import os

try:
    # Look here if main.py is running the show
    from services.auth_service import get_access_token
except ImportError:
    # Look here if I am running THIS file by itself for a test
    from auth_service import get_access_token

def get_campaigns(access_token, profile_id):
    # Endpoint for Sponsored Products Campaigns
    url = "https://advertising-api.amazon.com/v2/campaigns"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Amazon-Advertising-API-ClientId": os.getenv("AMZ_CLIENT_ID"),
        "Amazon-Advertising-API-Scope": profile_id, # This tells Amazon WHICH account to look at
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return f"Error fetching campaigns: {e}"

if __name__ == "__main__":
    from auth_service import get_access_token
    
    # 1. Get Token
    token = get_access_token()
    
    # 2. Use YOUR US Profile ID here
    US_PROFILE_ID = "1279339718510959" 
    
    print(f"📡 Fetching campaigns for Profile {US_PROFILE_ID}...")
    campaigns = get_campaigns(token, US_PROFILE_ID)
    
    if isinstance(campaigns, list):
        print(f"✅ Found {len(campaigns)} campaigns!")
        for c in campaigns[:5]: # Just show the first 5
            print(f"  - {c['name']} (Status: {c['state']})")
    else:
        print(campaigns)