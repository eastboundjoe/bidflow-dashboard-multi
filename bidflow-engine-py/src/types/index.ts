// BidFlow Engine Type Definitions

export interface TenantCredentials {
  id: string;
  tenant_id: string;
  profile_id: string;
  refresh_token: string;
  marketplace: string;
  account_name: string;
  is_active: boolean;
  schedule_days: number[];
  created_at: string;
  updated_at: string;
}

export interface Portfolio {
  portfolio_id: string;
  name: string;
  budget_amount: number | null;
  budget_policy: string | null;
  state: string;
}

export interface Campaign {
  campaign_id: string;
  portfolio_id: string | null;
  name: string;
  state: string;
  budget: number;
  budget_type: string;
  bidding_strategy: string;
  bid_top_of_search: number;
  bid_rest_of_search: number;
  bid_product_page: number;
}

export interface ReportConfig {
  name: string;
  reportTypeId: string;
  groupBy: string[];
  timeUnit: 'SUMMARY' | 'DAILY';
  lookBack: number;
}

export interface ReportLedgerEntry {
  id?: string;
  credential_id: string;
  snapshot_id: string;
  report_name: string;
  report_request_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  download_url?: string;
  error_message?: string;
  created_at?: string;
  completed_at?: string;
}

export interface WeeklySnapshot {
  id?: string;
  credential_id: string;
  week_label: string;
  snapshot_date: string;
  status: 'COLLECTING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  portfolios_count?: number;
  campaigns_count?: number;
  reports_requested?: number;
  reports_completed?: number;
  created_at?: string;
  completed_at?: string;
}

export interface SchedulerLogEntry {
  id?: string;
  run_date: string;
  tenant_count: number;
  success_count: number;
  failure_count: number;
  duration_ms: number;
  errors?: string[];
  created_at?: string;
}

export interface CampaignReportRow {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales14d: number;
  purchases14d: number;
}

export interface PlacementReportRow {
  campaignId: string;
  campaignName: string;
  placementClassification: string;
  impressions: number;
  clicks: number;
  cost: number;
  sales14d: number;
  purchases14d: number;
}

export interface StagingCampaignReport {
  credential_id: string;
  snapshot_id: string;
  campaign_id: string;
  campaign_name: string;
  report_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  purchases: number;
  acos: string;
  cvr: string;
}

export interface StagingPlacementReport {
  credential_id: string;
  snapshot_id: string;
  campaign_id: string;
  campaign_name: string;
  placement: string;
  report_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  purchases: number;
  acos: string;
  cvr: string;
}

export interface AmazonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AmazonReportResponse {
  reportId: string;
  status: string;
  statusDetails?: string;
  url?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export type AlertSeverity = 'error' | 'critical';

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}
