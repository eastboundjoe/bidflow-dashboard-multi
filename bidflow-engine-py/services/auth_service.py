import os
import requests
from dotenv import load_dotenv

# This looks for the .env file and loads the variables into memory
load_dotenv()

def get_access_token():
    # Now we pull the values using os.getenv
    client_id = os.getenv("APP_ADS_CLIENT_ID")
    client_secret = os.getenv("APP_ADS_CLIENT_SECRET")
    refresh_token = os.getenv("AMZ_REFRESH_TOKEN")

    url = "https://api.amazon.com/auth/o2/token"
    payload = {
        "grant_type": "refresh_token",
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token
    }
    
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status() 
        return response.json().get("access_token")
    except Exception as e:
        return f"Error: {e}"

# This is our local test operator
if __name__ == "__main__":
    print("Connecting to Amazon using .env secrets...")
    print(f"Token: {get_access_token()}")