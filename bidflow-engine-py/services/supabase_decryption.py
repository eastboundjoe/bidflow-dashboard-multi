# services/supabase_decryption.py
import psycopg2
from psycopg2.extras import RealDictCursor
import os

def get_tenant_refresh_token(tenant_id):
    # """
    # REPLACES: n8n 'Postgres' SQL Node.
    # Accesses the Supabase Vault to retrieve the decrypted refresh token.
    # """
    # This URL should be in your .env or Doppler
    # Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
    db_url = os.getenv("DATABASE_URL") 
    
    if not db_url:
        print("❌ Error: DATABASE_URL not found in environment.")
        return None

    query = """
    SELECT decrypted_secret as refresh_token
    FROM vault.decrypted_secrets
    WHERE id = (
        SELECT vault_id_refresh_token 
        FROM public.credentials 
        WHERE tenant_id = %s
    );
    """

    try:
        # Connect to Supabase
        conn = psycopg2.connect(db_url)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, (tenant_id,))
            result = cur.fetchone()
            
            if result:
                return result['refresh_token']
            else:
                print(f"⚠️ No refresh token found for tenant: {tenant_id}")
                return None
                
    except Exception as e:
        print(f"❌ Supabase Decryption Error: {e}")
        return None
    finally:
        if 'conn' in locals():
            conn.close()