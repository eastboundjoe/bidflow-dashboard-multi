-- =====================================================
-- MIGRATION 005: SUPABASE AUTH TRIGGER
-- =====================================================
-- Purpose: Automatically create tenant + user when someone signs up via Supabase Auth
-- Dependencies: 001_add_multi_tenant_tables.sql (tenants, users tables must exist)
-- Rollback: See rollback_005.sql
-- Estimated Time: 1 minute
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: GET USER TENANT ID
-- =====================================================
-- Returns the tenant_id for the currently authenticated user

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_tenant UUID;
BEGIN
  SELECT tenant_id INTO user_tenant
  FROM users
  WHERE id = auth.uid();

  RETURN user_tenant;
END;
$$;

COMMENT ON FUNCTION get_user_tenant_id() IS
'Returns tenant_id for currently authenticated user. Used in RLS policies and frontend queries.';

GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO service_role;

-- =====================================================
-- HELPER FUNCTION: CHECK USER PERMISSION
-- =====================================================
-- Checks if current user has a specific permission

CREATE OR REPLACE FUNCTION user_has_permission(permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  has_perm BOOLEAN;
BEGIN
  -- Get user's role
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();

  -- Admin has all permissions
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Check specific permission in JSONB permissions column
  SELECT (permissions ? permission_name) INTO has_perm
  FROM users
  WHERE id = auth.uid();

  RETURN COALESCE(has_perm, FALSE);
END;
$$;

COMMENT ON FUNCTION user_has_permission(TEXT) IS
'Checks if current user has specific permission. Admins automatically have all permissions.';

GRANT EXECUTE ON FUNCTION user_has_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(TEXT) TO service_role;

-- =====================================================
-- HELPER FUNCTION: USER HAS ROLE
-- =====================================================
-- Checks if current user has a specific role

CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();

  RETURN user_role = role_name;
END;
$$;

COMMENT ON FUNCTION user_has_role(TEXT) IS
'Checks if current user has specific role (admin, manager, user, viewer).';

GRANT EXECUTE ON FUNCTION user_has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_role(TEXT) TO service_role;

-- =====================================================
-- MAIN TRIGGER FUNCTION: AUTO-CREATE TENANT ON SIGNUP
-- =====================================================
-- This function runs automatically when a new user signs up via Supabase Auth

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  company_name TEXT;
  tenant_slug TEXT;
BEGIN
  -- Extract company name from user metadata (optional)
  company_name := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    SPLIT_PART(NEW.email, '@', 1) || '''s Company'
  );

  -- Generate URL-safe slug from email
  tenant_slug := LOWER(REGEXP_REPLACE(
    COALESCE(
      NEW.raw_user_meta_data->>'company_slug',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    '[^a-z0-9-]', '-', 'g'
  ));

  -- Ensure slug is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM tenants WHERE slug = tenant_slug) LOOP
    tenant_slug := tenant_slug || '-' || SUBSTRING(gen_random_uuid()::TEXT, 1, 4);
  END LOOP;

  -- Create new tenant for this user
  INSERT INTO tenants (name, slug, plan)
  VALUES (
    company_name,
    tenant_slug,
    'free' -- New signups start on free plan
  )
  RETURNING id INTO new_tenant_id;

  RAISE NOTICE 'Created tenant: % (slug: %, id: %)', company_name, tenant_slug, new_tenant_id;

  -- Create user record linked to tenant
  INSERT INTO users (id, tenant_id, email, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    'admin' -- First user in tenant is automatically admin
  );

  RAISE NOTICE 'Created user: % as admin of tenant %', NEW.email, new_tenant_id;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't prevent auth signup
    RAISE WARNING 'Failed to create tenant for user %: %', NEW.email, SQLERRM;
    -- Rethrow exception to prevent orphaned auth.users record
    RAISE;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS
'Trigger function that creates tenant + user record when someone signs up via Supabase Auth. First user becomes admin of their tenant.';

-- =====================================================
-- CREATE TRIGGER
-- =====================================================
-- Attach trigger to auth.users table

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
'Automatically creates tenant and user record when new user signs up via Supabase Auth.';

-- =====================================================
-- OPTIONAL: INVITE USER TO EXISTING TENANT
-- =====================================================
-- For invite-only scenarios or adding additional users to existing tenants

CREATE OR REPLACE FUNCTION invite_user_to_tenant(
  p_email TEXT,
  p_tenant_id UUID,
  p_role TEXT DEFAULT 'user'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('admin', 'manager', 'user', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, manager, user, or viewer', p_role;
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = p_email;

  IF existing_user_id IS NOT NULL THEN
    -- User already has auth account, just add to tenant
    INSERT INTO users (id, tenant_id, email, role)
    VALUES (existing_user_id, p_tenant_id, p_email, p_role)
    ON CONFLICT (id) DO UPDATE
    SET tenant_id = p_tenant_id, role = p_role;

    RAISE NOTICE 'Added existing user % to tenant %', p_email, p_tenant_id;
    RETURN existing_user_id;
  ELSE
    -- User doesn't exist yet - you'll need to send them signup link
    -- This function just reserves the email for the tenant
    RAISE NOTICE 'User % does not exist in auth.users yet. Send them signup link.', p_email;
    RETURN NULL;
  END IF;
END;
$$;

COMMENT ON FUNCTION invite_user_to_tenant(TEXT, UUID, TEXT) IS
'Adds existing authenticated user to a tenant. For new users, send them Supabase Auth signup link first.';

GRANT EXECUTE ON FUNCTION invite_user_to_tenant(TEXT, UUID, TEXT) TO service_role;

-- =====================================================
-- VERIFICATION & TESTING
-- =====================================================
-- Test the auth trigger:
--
-- 1. Sign up a test user via Supabase Auth:
-- Go to: Dashboard → Authentication → Users → Add User
-- Email: test@example.com
-- Password: test123456
--
-- 2. Check tenant and user were created:
/*
SELECT
  u.id as user_id,
  u.email,
  u.role,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.plan
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'test@example.com';
*/
-- Should show 1 row with tenant created and user as 'admin'
--
-- 3. Test helper functions:
/*
-- Set auth context (simulate logged in user)
SET request.jwt.claims = '{"sub": "YOUR_TEST_USER_UUID"}';

-- Get tenant ID
SELECT get_user_tenant_id();
-- Should return tenant UUID

-- Check role
SELECT user_has_role('admin');
-- Should return true for first user

-- Check permission (admins have all permissions)
SELECT user_has_permission('can_invite_users');
-- Should return true for admin
*/
--
-- 4. Test signup flow end-to-end:
-- a) User signs up via your frontend with Supabase Auth
-- b) Trigger creates tenant automatically
-- c) User is redirected to onboarding: "Connect Your Amazon Account"
-- d) User sees their tenant name in UI
--
-- 5. Verify trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'on_auth_user_created';
-- -- Should show trigger on auth.users table

-- =====================================================
-- USER SIGNUP FLOW (FOR FRONTEND DEVELOPERS)
-- =====================================================
/*
Frontend signup flow:

1. User fills signup form (email, password, optional company name)
2. Frontend calls Supabase Auth signup:
   const { data, error } = await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'securepassword',
     options: {
       data: {
         company_name: 'Acme Corp', // Optional
         company_slug: 'acme-corp'   // Optional
       }
     }
   })

3. Supabase creates auth.users record
4. Trigger fires → creates tenant + users record
5. User receives confirmation email
6. User confirms email → redirected to app
7. Frontend calls GET /get-user-context to fetch tenant info
8. Show onboarding: "Connect Your Amazon Ads Account"
9. User submits credentials → calls POST /add-amazon-account
10. Credentials encrypted and stored
11. User sees: "Setup complete! Collecting your data..."
12. scheduled-workflow-runner picks up new account
13. User sees their first report in ~5 minutes
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
