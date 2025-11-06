// =====================================================
// Database Types - Amazon Placement Optimization
// =====================================================
// Generated from Supabase database schema
// Project: phhatzkwykqdqfkxinvr
// =====================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workflow_executions: {
        Row: {
          id: string
          execution_id: string
          status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
          workflow_type: string
          started_at: string
          completed_at: string | null
          error_message: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          execution_id: string
          status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
          workflow_type?: string
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          execution_id?: string
          status?: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
          workflow_type?: string
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      report_requests: {
        Row: {
          id: string
          execution_id: string
          report_id: string
          report_name: string
          report_type: 'placement_30day' | 'placement_7day' | 'campaign_30day' | 'campaign_7day' | 'campaign_yesterday' | 'campaign_day_before'
          status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
          download_url: string | null
          url_expires_at: string | null
          rows_processed: number
          error_details: string | null
          requested_at: string
          completed_at: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          execution_id: string
          report_id: string
          report_name: string
          report_type: 'placement_30day' | 'placement_7day' | 'campaign_30day' | 'campaign_7day' | 'campaign_yesterday' | 'campaign_day_before'
          status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
          download_url?: string | null
          url_expires_at?: string | null
          rows_processed?: number
          error_details?: string | null
          requested_at?: string
          completed_at?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          execution_id?: string
          report_id?: string
          report_name?: string
          report_type?: 'placement_30day' | 'placement_7day' | 'campaign_30day' | 'campaign_7day' | 'campaign_yesterday' | 'campaign_day_before'
          status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
          download_url?: string | null
          url_expires_at?: string | null
          rows_processed?: number
          error_details?: string | null
          requested_at?: string
          completed_at?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      portfolios: {
        Row: {
          id: string
          portfolio_id: string
          portfolio_name: string
          portfolio_state: string
          in_budget: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          portfolio_name: string
          portfolio_state?: string
          in_budget?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          portfolio_name?: string
          portfolio_state?: string
          in_budget?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          campaign_id: string
          campaign_name: string
          campaign_status: string
          portfolio_id: string | null
          daily_budget: number
          bid_top_of_search: number
          bid_rest_of_search: number
          bid_product_page: number
          targeting_type: string | null
          start_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          campaign_name: string
          campaign_status: string
          portfolio_id?: string | null
          daily_budget?: number
          bid_top_of_search?: number
          bid_rest_of_search?: number
          bid_product_page?: number
          targeting_type?: string | null
          start_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          campaign_name?: string
          campaign_status?: string
          portfolio_id?: string | null
          daily_budget?: number
          bid_top_of_search?: number
          bid_rest_of_search?: number
          bid_product_page?: number
          targeting_type?: string | null
          start_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      campaign_performance: {
        Row: {
          id: string
          campaign_id: string
          period_type: '30day' | '7day' | 'yesterday' | 'day_before'
          report_date: string
          impressions: number
          clicks: number
          spend: number
          orders_7d: number
          sales_7d: number
          orders_14d: number
          sales_14d: number
          orders_30d: number
          sales_30d: number
          top_of_search_impression_share: number | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          period_type: '30day' | '7day' | 'yesterday' | 'day_before'
          report_date: string
          impressions?: number
          clicks?: number
          spend?: number
          orders_7d?: number
          sales_7d?: number
          orders_14d?: number
          sales_14d?: number
          orders_30d?: number
          sales_30d?: number
          top_of_search_impression_share?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          period_type?: '30day' | '7day' | 'yesterday' | 'day_before'
          report_date?: string
          impressions?: number
          clicks?: number
          spend?: number
          orders_7d?: number
          sales_7d?: number
          orders_14d?: number
          sales_14d?: number
          orders_30d?: number
          sales_30d?: number
          top_of_search_impression_share?: number | null
          created_at?: string
        }
      }
      placement_performance: {
        Row: {
          id: string
          campaign_id: string
          placement: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE'
          period_type: '30day' | '7day'
          report_date: string
          impressions: number
          clicks: number
          spend: number
          orders_7d: number
          sales_7d: number
          orders_30d: number
          sales_30d: number
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          placement: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE'
          period_type: '30day' | '7day'
          report_date: string
          impressions?: number
          clicks?: number
          spend?: number
          orders_7d?: number
          sales_7d?: number
          orders_30d?: number
          sales_30d?: number
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          placement?: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE'
          period_type?: '30day' | '7day'
          report_date?: string
          impressions?: number
          clicks?: number
          spend?: number
          orders_7d?: number
          sales_7d?: number
          orders_30d?: number
          sales_30d?: number
          created_at?: string
        }
      }
    }
    Views: {
      view_placement_optimization_report: {
        Row: {
          Campaign: string
          Portfolio: string | null
          Budget: number
          'Clicks-30': number
          'Spend-30': number
          'Orders-30': number
          'CVR-30': number
          'ACoS-30': number
          'Clicks-7': number
          'Spend-7': number
          'Orders-7': number
          'CVR-7': number
          'ACoS-7': number
          'Spent DB Yesterday': number
          'Spent Yesterday': number
          'Array Formula': null
          'Last 30 days': number
          'Last 7 days': number
          Yesterday: number
          'Placement Type': string
          'Increase bids by placement': number
          'Changes in placement': string
          NOTES: string
        }
      }
    }
    Functions: {
      get_amazon_ads_credentials: {
        Args: Record<string, never>
        Returns: {
          client_id: string
          client_secret: string
          refresh_token: string
        }[]
      }
      truncate_performance_data: {
        Args: Record<string, never>
        Returns: void
      }
    }
  }
}
