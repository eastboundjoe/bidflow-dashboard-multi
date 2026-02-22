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
