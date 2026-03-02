// Type definitions for BidFlow

import { SubscriptionTier } from "@/lib/constants";

// User and Auth Types
export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Session {
  user: User;
  access_token: string;
  refresh_token: string;
}

// Subscription Types
export interface SubscriptionStatus {
  subscription_tier: SubscriptionTier;
  subscription_status: "active" | "trialing" | "canceled" | "past_due" | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
}

// Credentials Types
export interface Credentials {
  tenant_id: string;
  amazon_profile_id: string | null;
  profile_id: string | null; // Support both names for compatibility
  vault_id_refresh_token: string | null;
  vault_id_client_id: string | null;
  vault_id_client_secret: string | null;
  refresh_token: string | null;
  status: "active" | "inactive";
  report_day: string;
  report_hour: number;
  created_at: string;
  updated_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_tier: string | null;
}

export interface CredentialFormData {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  profileId: string;
}

// Schedule Settings
export interface ScheduleSettings {
  report_day: string;
  report_hour: number;
}

// Placement Data Types
export interface PlacementData {
  id: string;
  tenant_id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_budget: number | null;
  portfolio_id: string | null;
  portfolio_name: string | null;
  placement_type: string;
  
  // 30-day metrics
  impressions: number;
  clicks: number;
  spend: number;
  orders: number;
  sales: number;
  units: number;
  ctr: number;
  cpc: number;
  acos: number;
  roas: number;
  cvr: number;

  // 7-day metrics
  clicks_7d: number;
  spend_7d: number;
  orders_7d: number;
  sales_7d: number;
  units_7d: number;
  cvr_7d: number;
  acos_7d: number;

  // Spend timing metrics
  spent_db_yesterday: number;
  spent_yesterday: number;

  // Impression share metrics
  impression_share_30d: string;
  impression_share_7d: string;
  impression_share_yesterday: string;

  // Bid adjustments
  bid_adjustment: number;
  changes_in_placement: string;
  changed_at?: string; // e.g. "2/22" — set after successful submission

  // Weekly notes & goal tracking
  note: string;
  goal_completed: boolean | null;

  week_id: string;
  date_range_start: string;
  date_range_end: string;
}

// Stats Summary
export interface StatsSummary {
  totalSpend: number;
  totalSales: number;
  totalClicks: number;
  totalImpressions: number;
  totalOrders: number;
  avgAcos: number;
  avgRoas: number;
  avgCtr: number;
  avgCvr: number;
}

// Table Sort Configuration
export interface SortConfig {
  key: keyof PlacementData | null;
  direction: "asc" | "desc";
}

// Sankey Chart Types
export interface SankeyNode {
  name: string;
  value?: number;
}

export interface SankeyLink {
  source: number;
  target: number;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ─── Bid Optimizer (Layer 3) Types ───────────────────────────────────────────

export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  portfolio_id: string | null;
  portfolio_name: string | null;
  budget: number;
  spend_30d: number;
  orders_30d: number;
  acos_30d: number | null;
  spend_7d: number;
  orders_7d: number;
  acos_7d: number | null;
  yesterday_spend: number;
  day_before_spend: number;
  week_id: string;
}

export interface CampaignRules {
  bleeders: boolean;
  high_acos_threshold: number | null;   // min ACOS % — reduce bids above this
  low_clicks_increase: number | null;   // % to increase targets with ≤1 click
  good_acos_increase: number | null;    // % to increase good-ACOS targets
  good_acos_max: number | null;         // ACOS ceiling defining "good"
  new_budget: number | null;
  pause: boolean;
  notes: string;
}

export interface TargetingRow {
  id: string;
  target_id: string;
  campaign_id: string;
  campaign_name: string;
  ad_group_id: string | null;
  ad_group_name: string | null;
  targeting_text: string;
  targeting_type: string;
  match_type: string;
  bid: number;
  clicks_30d: number;
  orders_30d: number;
  acos_30d: number | null;
  clicks_7d: number;
  orders_7d: number;
  acos_7d: number | null;
  week_id: string;
}

export type BidChangeRule = "bleeders" | "high_acos" | "low_clicks" | "good_acos" | "manual_override";

export interface BidChange {
  target_id: string;
  campaign_id: string;
  campaign_name: string;
  targeting_text: string;
  match_type: string;
  old_bid: number;
  new_bid: number;
  rule_applied: BidChangeRule;
  overridden: boolean;
  excluded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Stripe Types
export interface CheckoutSessionRequest {
  priceId: string;
  tier: SubscriptionTier;
}

export interface PortalSessionRequest {
  customerId: string;
}
