# services/api_listener.py
from fastapi import FastAPI, BackgroundTasks
from main import run_bidflow_engine

app = FastAPI()

@app.post("/trigger-sync")
async def trigger_sync(tenant_id: str, background_tasks: BackgroundTasks):
    
    # This replaces the 'Webhook from Vercel' node in n8n.
    # It takes the tenant_id and starts the engine in the background.
  
    # We run it as a 'background task' so the website gets 
    # an instant "Success" message while the engine works.
    background_tasks.add_task(run_bidflow_engine, tenant_id)
    
    return {"status": "success", "message": f"Sync started for {tenant_id}"}