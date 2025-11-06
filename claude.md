# Project: Code Workspace

## Overview
This is the main code workspace containing multiple projects related to Amazon advertising, FBA operations, automation workflows, and integrations.

## Current Phase
Major Architecture Rebuild - Amazon Placement Optimization System
- Multi-agent collaboration completed: specification, API integration plan, database schema design
- MCP servers configured and operational (n8n, Amazon Ads API, Supabase)
- Plain English database documentation completed (DATABASE_SCHEMA_EXPLAINED.md)
- GitHub SSH authentication configured and working
- Phase 1 Database Deployment: COMPLETE
  - Database deployed successfully to Supabase (project: phhatzkwykqdqfkxinvr)
  - 6 tables created with RLS policies, indexes, and foreign keys
  - 1 view created: view_placement_optimization_report
  - Helper function created: truncate_performance_data()
  - Tested with sample data and verified all functionality
- Phase 2 Vault Configuration: COMPLETE
  - pgsodium extension enabled for encryption
  - 3 secrets stored in Vault (client_id, client_secret, refresh_token)
  - Helper function created: get_amazon_ads_credentials()
  - All secrets encrypted with AES-256
  - Tested and verified vault retrieval
- Phase 3 Edge Functions Development: COMPLETE
  - New project created: placement-optimization-functions/
  - Supabase project initialized and linked
  - TypeScript types generated from database schema
  - 3 Edge Functions created and ready to deploy:
    - workflow-executor (main orchestrator)
    - report-collector (Amazon Ads API integration)
    - report-generator (report query and export)
  - 4 shared utilities created:
    - supabase-client.ts (database + vault access)
    - amazon-ads-client.ts (API client with OAuth)
    - types.ts (shared interfaces)
    - errors.ts (error handling)
  - Comprehensive documentation created (README.md, DEPLOYMENT.md)
- Phase 4: Deployment and Testing - READY TO START
  - Need to deploy Edge Functions to Supabase
  - Need to test end-to-end workflow
  - Need to update vault with real credentials

## Active Projects

### Amazon Ads & Placement Reporting
- **Focus:** Building tools and workflows for Amazon advertising placement reports
- **Status:** In development
- **Key Goal:** Optimize Amazon ad placements using data-driven insights

### Ramen Bomb FBA Operations
- **Focus:** Managing Amazon FBA operations for Ramen Bomb LLC brands
- **Status:** Ongoing operations
- **Brands:** Ramen Bomb, InnerIcons
- **Key Listings:** B0D7DSWRMK, B07BYYNKCY

### Automation & Integration
- **MCP Servers:** Building Model Context Protocol servers for various integrations
- **n8n Workflows:** Automation workflows for business processes
- **Supabase:** Database and backend infrastructure

## Key Files

### Documentation
- `placement_report_specification.md` - Comprehensive specification for placement reporting (42KB)
- `api_integration_plan.md` - API integration architecture and workflow design (66KB)
- `new_database_schema_design.md` - Complete Supabase database schema v2.0 (50KB)
- `DATABASE_SCHEMA_EXPLAINED.md` - Plain English walkthrough of database schema (20KB)
- `database_schema.sql` - SQL DDL for database implementation (15KB)
- `IMPLEMENTATION_PLAN.md` - 5-phase implementation roadmap (13KB)
- `supabase_architecture.md` - Supabase architecture documentation (92KB)
- `PLACEMENT_REPORT_RESEARCH_SUMMARY.md` - Research summary on placement reports
- `QUICK_REFERENCE_DATA_POINTS.md` - Quick reference for data points

### Database Deployment Documentation (Created 2024-11-05)
- `create_database.sql` - Production-ready SQL deployment script (431 lines, 15KB)
- `verify_deployment.sql` - Verification queries for testing deployment (129 lines, 4KB)
- `test_sample_data.sql` - Sample data for testing the view (9 rows)
- `cleanup_test_data.sql` - Script to remove test data before production
- `DEPLOYMENT_QUICKSTART.md` - 1-minute deployment guide (3KB)
- `DATABASE_DEPLOYMENT_INDEX.md` - Navigation hub for all deployment docs (12KB)
- `DEPLOYMENT_INSTRUCTIONS.md` - Detailed step-by-step deployment guide (8KB)
- `DATABASE_VISUAL_SUMMARY.md` - ER diagrams and architecture overview (17KB)
- `DEPLOYMENT_SUMMARY.md` - Complete deployment overview (15KB)
- `TROUBLESHOOTING_GUIDE.md` - Common issues and solutions (12KB)

### Vault Configuration Documentation (Created 2024-11-06)
- `VAULT_SETUP_GUIDE.md` - Comprehensive vault configuration guide (28KB)
- `VAULT_QUICKSTART.md` - Quick reference for vault operations (3KB)
- `enable_vault_extensions.sql` - Script to enable pgsodium extension
- `create_vault_helper_function.sql` - Helper function for credential retrieval
- `test_vault_setup.sql` - Verification tests for vault configuration
- `update_vault_credentials.sql` - Script to update stored credentials

### Code Projects
- `placement-optimization-functions/` - Amazon Placement Optimization Edge Functions (NEW - Phase 3)
  - 3 Edge Functions + 4 shared utilities
  - TypeScript/Deno with full type safety
  - OAuth token management and Amazon Ads API integration
  - Ready for deployment to Supabase
- `bidflow/` - Bid flow management system
- `amazon-ads-api-mcp/` - Amazon Ads API MCP server
- `supabase-mcp/` - Supabase MCP server
- `n8n-mcp/` - n8n workflow MCP server
- `mcp-client/` - MCP client implementation

### Analysis Tools
- `analyze_placement_files.py` - Python script for analyzing placement data
- `analyze_docs.py` - Document analysis utilities

### Agent Configurations
- `.claude/agents/session-closer.md` - Session management and documentation agent
- `.claude/agents/amazon-placement-report-assistant.md` - Placement report specialist
- `.claude/agents/amazon-ads-api-expert.md` - Amazon Ads API integration expert
- `.claude/agents/supabase-architect.md` - Database architecture specialist
- `.claude/agents/n8n-flow-analyzer.md` - N8N workflow analysis expert

## Decisions Made

### 2024-11-03: Session Management Infrastructure
**Decision:** Implemented comprehensive session closer workflow with git/GitHub integration
**Reasoning:**
- Need systematic way to document sessions across multiple projects
- Prevent context loss when switching between sessions (inspired by NetworkChuck)
- Enable version control rollback if changes break something
- Maintain cloud backup of all work
**Impact:**
- Can now end sessions properly with @session-closer command
- All work automatically documented in session-summary.md
- Git commits created with meaningful messages
- Changes pushed to private GitHub repository for backup

### 2024-11-03: Git & GitHub Configuration
**Decision:** Private GitHub repository with HTTPS authentication using Personal Access Token
**Reasoning:**
- Private repo protects business-sensitive code and Amazon advertising strategies
- HTTPS more accessible than SSH in WSL environment
- Personal Access Token more secure than password authentication
- Credential helper stores token for convenience
**Impact:**
- Repository: https://github.com/eastboundjoe/code-workspace (private)
- Easy push workflow for daily backups
- Cloud backup protects against local data loss

### 2024-11-03: Context File Strategy
**Decision:** Use claude.md and session-summary.md as persistent memory system
**Reasoning:**
- Browser AI loses context; terminal AI with files maintains it
- Context files load automatically when starting new Claude session
- Session history provides continuity across days/weeks
- Can reference past decisions and their rationale
**Impact:**
- Next session will immediately understand project state
- No need to re-explain project context
- Historical record of decisions and progress

### 2024-11-03: Multi-Agent Architecture Approach
**Decision:** Use specialized domain agents for complex system design
**Reasoning:**
- Amazon Placement Optimization system requires expertise across 3 domains (reporting, API, database)
- Single-agent approach would lack depth in specialized areas
- Multi-agent collaboration produces comprehensive specifications
- Each agent focuses on their domain strength
**Impact:**
- Created 3 comprehensive specification documents (42KB + 66KB + 50KB)
- Better architecture decisions from domain expertise
- Clear separation of concerns (data layer, API layer, presentation layer)
- Reproducible process for future projects

### 2024-11-03: Supabase Architecture Decisions
**Decision:** Full Supabase stack - Vault + Edge Functions + PostgreSQL
**Reasoning:**
- Supabase Vault for secrets (NOT Google Cloud KMS) - simpler, free, scalable to multiple users
- Regular views (NOT materialized) - 2-5 second query time acceptable for weekly reports
- TypeScript Edge Functions (NOT N8N workflows) - better version control, testing, debugging
- Direct cutover (NOT parallel run) - N8N on different account, clean separation
**Impact:**
- Simpler architecture with fewer external dependencies
- All infrastructure in one platform (Supabase)
- Better developer experience with TypeScript
- Ready for Phase 1: Database implementation

### 2024-11-03: MCP Server Strategy
**Decision:** Configure and use 3 MCP servers for development workflow
**Reasoning:**
- n8n-mcp provides workflow analysis capabilities
- amazon-ads-api-mcp gives API expertise and real-time data
- supabase-mcp enables database operations and OAuth
- MCP servers provide specialized context for agents
**Impact:**
- n8n-mcp: Running on Docker at localhost:3000
- amazon-ads-api-mcp: Running on Docker at localhost:3001
- supabase: Using hosted OAuth at https://mcp.supabase.com/mcp
- Agents can leverage specialized MCP tools for their domains

### 2024-11-03: GitHub Authentication Method Switch
**Decision:** Switched from HTTPS with Personal Access Token to SSH key authentication
**Reasoning:**
- SSH keys more secure than tokens (no expiration, no scope limitations)
- Better integration with WSL2 environment
- Industry standard for git authentication
- Eliminates need to manage token expiration
**Impact:**
- Generated ED25519 SSH key pair in WSL2
- Added public key to GitHub account
- Repository remote updated to use SSH URL (git@github.com:eastboundjoe/code-workspace.git)
- All future pushes use SSH authentication
- More seamless git workflow

### 2024-11-05: Manual SQL Deployment Strategy
**Decision:** Manual copy/paste deployment instead of automated MCP-based deployment
**Reasoning:**
- MCP tools not available in this session context
- Manual deployment faster (2 minutes) than troubleshooting MCP
- Supabase SQL Editor is reliable and user-friendly
- User has direct control over execution
- Lower complexity for one-time deployment task
**Impact:**
- Created comprehensive deployment documentation (9 files, 106KB)
- User executes SQL manually in Supabase Dashboard
- Reduces technical dependencies
- Clear step-by-step instructions ensure success

### 2024-11-06: Vault Configuration via UI Instead of SQL
**Decision:** Configure Supabase Vault secrets through Dashboard UI instead of SQL commands
**Reasoning:**
- Vault secrets management requires special security context
- Supabase Dashboard UI provides secure, encrypted input forms
- SQL approach would expose secrets in query history
- UI method is the officially documented approach
- Simpler and more secure for credential management
**Impact:**
- All 3 Amazon Ads API secrets stored securely via UI
- No credentials exposed in SQL files or git history
- Created helper function get_amazon_ads_credentials() for retrieval
- Edge Functions can access credentials securely at runtime

### 2024-11-06: Skip pg_cron Scheduled Jobs in Initial Deployment
**Decision:** Deploy database without pg_cron extension and scheduled cleanup job
**Reasoning:**
- pg_cron extension requires manual enablement in Supabase Dashboard
- Not critical for MVP functionality (cleanup can be manual)
- Simplified initial deployment reduces failure points
- Can add pg_cron later when needed for automation
- Database still has truncate_performance_data() function for manual cleanup
**Impact:**
- Modified create_database.sql to skip cron job creation
- Added clear comments on how to enable pg_cron later
- Database deployment succeeded without extension dependency
- 90-day data retention will be handled manually until automation added

### 2024-11-06: Separate Project Directory for Edge Functions
**Decision:** Create placement-optimization-functions/ as separate project directory with own Supabase init
**Reasoning:**
- Clean separation between documentation and implementation code
- Enables proper Supabase CLI tooling (supabase init, link, deploy)
- Makes project portable and easier to understand
- Separates TypeScript/Deno runtime concerns from main workspace
- Clearer git structure (project has own .gitignore)
**Impact:**
- Created new directory: placement-optimization-functions/
- Initialized as Supabase project with config.toml
- Generated database.types.ts specific to this project
- Edge Functions organized in supabase/functions/ directory
- Shared utilities in supabase/functions/_shared/
- Complete project documentation in README.md and DEPLOYMENT.md

## Next Steps

### Phase 4: Deploy and Test Edge Functions (READY TO START)

#### 1. Update Vault with Real Credentials
Before deployment, update the placeholder credentials in Supabase Vault:
1. Open Supabase Dashboard: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/settings/vault
2. Update 3 secrets with real Amazon Ads API values:
   - amazon_ads_client_id
   - amazon_ads_client_secret
   - amazon_ads_refresh_token

#### 2. Deploy Edge Functions to Supabase
From placement-optimization-functions/ directory:
```bash
cd placement-optimization-functions
supabase functions deploy workflow-executor
supabase functions deploy report-collector
supabase functions deploy report-generator
```

#### 3. Test Each Function Individually
Test workflow-executor:
```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/workflow-executor \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

Test report-generator:
```bash
curl -X POST https://phhatzkwykqdqfkxinvr.supabase.co/functions/v1/report-generator \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

#### 4. End-to-End Testing
1. Trigger full workflow:
   - Call workflow-executor with real execution
   - Monitor Supabase logs for progress
   - Verify workflow_executions record created
2. Verify data collection:
   - Check portfolios table populated
   - Check campaigns table populated
   - Check campaign_performance and placement_performance tables
   - Query view: `SELECT * FROM view_placement_optimization_report`
3. Error handling testing:
   - Test with invalid credentials (expect auth error)
   - Test with network issues (expect retry)
   - Verify error messages logged properly
4. Performance validation:
   - Measure view query time with real data
   - Should be under 5 seconds for weekly reports

#### 5. Set Up Scheduled Execution (Optional)
Configure cron trigger for weekly execution:
- Use Supabase Edge Functions scheduled invocations
- Or external cron service (GitHub Actions, Cloud Scheduler, etc.)
- Recommended: Every Monday 6am UTC

### Phase 5: Production Readiness (After Testing)

### Ongoing Tasks
- Use @session-closer at end of each work session
- Document major decisions and learnings in claude.md
- Maintain session-summary.md for historical context
- Keep MCP servers updated and operational

## Reference Documents
- Agent configurations in `.claude/agents/`
- Project-specific documentation in respective project folders
- SOPs and business documentation (when working on Ramen Bomb FBA tasks)

## Notes
- This workspace contains multiple interconnected projects
- Use specialized agents for domain-specific tasks (amazon-ads-api-expert, amazon-placement-report-assistant, etc.)
- Keep session-summary.md updated for historical context
