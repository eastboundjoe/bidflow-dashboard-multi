# Project: Code Workspace

## Overview
This is the main code workspace containing multiple projects related to Amazon advertising, FBA operations, automation workflows, and integrations.

## Current Phase
Active development across multiple projects

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
- `placement_report_specification.md` - Specifications for placement reporting system
- `PLACEMENT_REPORT_RESEARCH_SUMMARY.md` - Research summary on placement reports
- `QUICK_REFERENCE_DATA_POINTS.md` - Quick reference for data points
- `api_integration_plan.md` - API integration planning and architecture

### Code Projects
- `bidflow/` - Bid flow management system
- `amazon-ads-api-mcp/` - Amazon Ads API MCP server
- `supabase-mcp/` - Supabase MCP server
- `n8n-mcp/` - n8n workflow MCP server
- `mcp-client/` - MCP client implementation

### Analysis Tools
- `analyze_placement_files.py` - Python script for analyzing placement data
- `analyze_docs.py` - Document analysis utilities

## Decisions Made

### 2024-11-03: Created Session Closer Agent
**Decision:** Implemented a session-closer agent inspired by NetworkChuck's workflow
**Reasoning:** Need systematic way to document sessions, update context files, and maintain git history
**Impact:** Can now properly close sessions with comprehensive documentation and version control

## Next Steps
1. Use the session-closer agent at end of each work session
2. Continue development on active projects
3. Maintain updated context files for continuity

## Reference Documents
- Agent configurations in `.claude/agents/`
- Project-specific documentation in respective project folders
- SOPs and business documentation (when working on Ramen Bomb FBA tasks)

## Notes
- This workspace contains multiple interconnected projects
- Use specialized agents for domain-specific tasks (amazon-ads-api-expert, amazon-placement-report-assistant, etc.)
- Keep session-summary.md updated for historical context
