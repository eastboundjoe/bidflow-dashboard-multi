import requests
import os

def get_profiles(access_token):
    # The endpoint for profiles
    url = "https://advertising-api.amazon.com/v2/profiles"
    
    # We need to tell Amazon who we are in the Headers
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Amazon-Advertising-API-ClientId": os.getenv("AMZ_CLIENT_ID"), # Still pulls from .env!
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return f"Error fetching profiles: {e}"

# Local test Operator
if __name__ == "__main__":
    from auth_service import get_access_token
    
    print("🔄 Getting fresh token...")
    token = get_access_token()
    
    print("📡 Fetching Profiles...")
    profiles = get_profiles(token)
    
    # Let's print them nicely
    if isinstance(profiles, list):
        for p in profiles:
            print(f"✅ Name: {p['accountInfo']['name']} | ID: {p['profileId']} | Country: {p['countryCode']}")
    else:
        print(profiles)