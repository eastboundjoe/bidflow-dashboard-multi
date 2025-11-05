# Project: Code Workspace

## Overview
This is the main code workspace containing multiple projects related to Amazon advertising, FBA operations, automation workflows, and integrations.

## Current Phase
Major Architecture Rebuild - Amazon Placement Optimization System
- Multi-agent collaboration completed: specification, API integration plan, database schema design
- MCP servers configured and operational (n8n, Amazon Ads API, Supabase)
- Plain English database documentation completed (DATABASE_SCHEMA_EXPLAINED.md)
- GitHub SSH authentication configured and working
- Phase 1 Database Deployment: READY TO EXECUTE
  - SQL deployment file prepared (create_database.sql - 431 lines)
  - Supabase project prepared (phhatzkwykqdqfkxinvr)
  - Comprehensive deployment documentation created (106KB, 9 files)
  - Awaiting manual SQL execution in Supabase Dashboard

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
- `DEPLOYMENT_QUICKSTART.md` - 1-minute deployment guide (3KB)
- `DATABASE_DEPLOYMENT_INDEX.md` - Navigation hub for all deployment docs (12KB)
- `DEPLOYMENT_INSTRUCTIONS.md` - Detailed step-by-step deployment guide (8KB)
- `DATABASE_VISUAL_SUMMARY.md` - ER diagrams and architecture overview (17KB)
- `DEPLOYMENT_SUMMARY.md` - Complete deployment overview (15KB)
- `TROUBLESHOOTING_GUIDE.md` - Common issues and solutions (12KB)

### Code Projects
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

## Next Steps

### IMMEDIATE: Execute Database Deployment (2 minutes)
1. Open Supabase SQL Editor:
   - URL: https://supabase.com/dashboard/project/phhatzkwykqdqfkxinvr/sql/new
2. Copy contents of `create_database.sql`
3. Paste into SQL Editor and click "Run"
4. Verify success message appears
5. Run `verify_deployment.sql` queries to confirm all objects created

### After Deployment: Phase 1 Completion
1. Generate TypeScript types from schema:
   - Command: `npx supabase gen types typescript --project-id phhatzkwykqdqfkxinvr > database.types.ts`
2. Test the view query performance:
   - Run: `SELECT * FROM view_placement_optimization_report`
   - Expected: Empty result set (no data yet), query completes in <5 seconds

### Then: Phase 2 - Edge Functions Development
1. Configure Supabase Vault:
   - Store Amazon Ads API credentials (client_id, client_secret, refresh_token)
   - Set up access policies for Edge Functions
   - Test credential retrieval
2. Set up local Supabase dev environment:
   - Install Supabase CLI: `npm install -g supabase`
   - Initialize: `supabase init`
   - Link to project: `supabase link --project-ref phhatzkwykqdqfkxinvr`
3. Create 3 Edge Functions:
   - workflow-executor (main orchestrator)
   - report-collector (Amazon Ads API integration)
   - report-generator (Google Sheets output)

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
