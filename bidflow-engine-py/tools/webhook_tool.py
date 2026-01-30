# tools/webhook_tool.py
import requests
import json

def notify_frontend(tenant_id, status, message, extra_data=None):
   
    # TOOL: notify_frontend
    # PURPOSE: Replaces the 'Trigger Flow 2' and 'Respond to Webhook' nodes.
    # Sends a POST request back to your website or Vercel app.
 
    # This would be your Vercel/Website endpoint
    url = "https://bidflow.app/api/sync-callback"
    
    payload = {
        "tenant_id": tenant_id,
        "status": status,
        "message": message,
        "data": extra_data or {}
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        print(f"🔔 Frontend notified for tenant {tenant_id}")
        return True
    except Exception as e:
        print(f"⚠️ Failed to notify frontend: {e}")
        return False