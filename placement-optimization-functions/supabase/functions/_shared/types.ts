// =====================================================
// Shared Types - Amazon Ads API & Database
// =====================================================

export interface Portfolio {
  portfolioId: string
  name: string
  state: string
  inBudget: boolean
}

export interface Campaign {
  campaignId: string
  name: string
  state: string
  portfolioId: string | null
  dailyBudget: number
  bidding: {
    adjustments: Array<{
      predicate: string
      percentage: number
    }>
  }
  targetingType: string
  startDate: string
}

export interface ReportRequest {
  reportId: string
  status: string
  statusDetails: string
  location?: string
  fileSize?: number
  expiresAt?: string
}

export interface ReportMetrics {
  campaignId: string
  impressions: number
  clicks: number
  cost: number
  purchases7d: number
  sales7d: number
  purchases14d: number
  sales14d: number
  purchases30d: number
  sales30d: number
  topOfSearchImpressionShare?: number
  placement?: string
}

export interface WorkflowExecution {
  execution_id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  started_at: string
  error_message?: string
}

export interface PlacementBidAdjustment {
  placement: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE'
  percentage: number
}

/**
 * Report types supported by the system
 */
export const REPORT_TYPES = {
  PLACEMENT_30DAY: 'placement_30day',
  PLACEMENT_7DAY: 'placement_7day',
  CAMPAIGN_30DAY: 'campaign_30day',
  CAMPAIGN_7DAY: 'campaign_7day',
  CAMPAIGN_YESTERDAY: 'campaign_yesterday',
  CAMPAIGN_DAY_BEFORE: 'campaign_day_before'
} as const

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES]

/**
 * Amazon Ads API configuration
 */
export const AMAZON_ADS_API = {
  BASE_URL: 'https://advertising-api.amazon.com',
  PROFILES_ENDPOINT: '/v2/profiles',
  REPORTS_ENDPOINT: '/v2/sp/reports',
  REPORT_DOWNLOAD_ENDPOINT: '/v2/reports',
  PORTFOLIOS_ENDPOINT: '/v2/portfolios/extended'
} as const
