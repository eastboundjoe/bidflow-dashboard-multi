// Application Constants

export const APP_NAME = "BidFlow";
export const APP_DESCRIPTION = "Amazon Placement Optimizer";

// Stripe Price IDs
export const STRIPE_PRICES = {
  STARTER: process.env.STRIPE_STARTER_PRICE_ID || "price_1SilYGCmYUDdt3YtJZUK1EB6",
} as const;

// n8n Webhooks
export const N8N_WEBHOOKS = {
  COLLECTION: process.env.N8N_COLLECTION_WEBHOOK || "https://n8n.bidflow.app/webhook/d4a5a8ed-0382-44e8-b011-b14e48a89b87",
  SUBMISSION: process.env.N8N_SUBMISSION_WEBHOOK || "https://n8n.bidflow.app/webhook/481801ae-ca24-4b0c-9a85-43fe438dfa1b",
  SEED: process.env.N8N_SEED_WEBHOOK || "https://n8n.bidflow.app/webhook/seed-current-week",
} as const;

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
  FREE: "free",
  STARTER: "starter",
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

// Placement Types
export const PLACEMENT_TYPES = {
  TOP_OF_SEARCH: "Top of Search",
  REST_OF_SEARCH: "Rest of Search",
  PRODUCT_PAGE: "Product Pages",
} as const;

export type PlacementType = typeof PLACEMENT_TYPES[keyof typeof PLACEMENT_TYPES];

// Feature Limits by Tier
export const TIER_LIMITS = {
  [SUBSCRIPTION_TIERS.FREE]: {
    historicalDays: 7,
    maxAccounts: 1,
    reportFrequency: "manual",
  },
  [SUBSCRIPTION_TIERS.STARTER]: {
    historicalDays: 90,
    maxAccounts: 5,
    reportFrequency: "weekly",
  },
} as const;

// Amazon OAuth
export const AMAZON_CLIENT_ID = process.env.NEXT_PUBLIC_AMAZON_CLIENT_ID || "amzn1.application-oa2-client.3bfbe7fd974d4a8f96d30372640e2701";
export const AMAZON_SCOPE = "advertising::campaign_management";

// Auto-refresh interval (5 minutes)
export const AUTO_REFRESH_INTERVAL = 300000;

// Day options for report scheduling
export const DAY_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
] as const;

// Hour options for report scheduling
export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label:
    i === 0
      ? "12:00 AM (Midnight)"
      : i === 12
      ? "12:00 PM (Noon)"
      : i < 12
      ? `${i}:00 AM`
      : `${i - 12}:00 PM`,
}));
