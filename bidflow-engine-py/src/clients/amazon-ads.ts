import axios, { AxiosInstance, AxiosError } from 'axios';
import { createGunzip } from 'zlib';
import { config } from '../config/index.js';
import { logger, logApiCall } from '../utils/logger.js';
import { withRetry, sleep } from '../utils/retry.js';
import type {
  Portfolio,
  Campaign,
  AmazonTokenResponse,
  AmazonReportResponse,
  ReportConfig,
  CampaignReportRow,
  PlacementReportRow,
} from '../types/index.js';

// Token cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
  profileId: string;
}

const tokenCache: Map<string, TokenCache> = new Map();

// Report configurations
export const REPORT_CONFIGS: ReportConfig[] = [
  {
    name: 'Campaign-30 Days',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign'],
    timeUnit: 'SUMMARY',
    lookBack: 30,
  },
  {
    name: 'Campaign-7 Days',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign'],
    timeUnit: 'SUMMARY',
    lookBack: 7,
  },
  {
    name: 'Placement-30 Days',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign', 'campaignPlacement'],
    timeUnit: 'SUMMARY',
    lookBack: 30,
  },
  {
    name: 'Placement-7 Days',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign', 'campaignPlacement'],
    timeUnit: 'SUMMARY',
    lookBack: 7,
  },
  {
    name: 'Campaign-Yesterday',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign'],
    timeUnit: 'DAILY',
    lookBack: 1,
  },
  {
    name: 'Campaign-DayBefore',
    reportTypeId: 'spCampaigns',
    groupBy: ['campaign'],
    timeUnit: 'DAILY',
    lookBack: 2,
  },
];

export class AmazonAdsClient {
  private profileId: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private httpClient: AxiosInstance;

  constructor(profileId: string, refreshToken: string, clientId?: string, clientSecret?: string) {
    this.profileId = profileId;
    this.refreshToken = refreshToken;
    // Use per-tenant credentials if provided, otherwise fall back to global config
    this.clientId = clientId || config.amazon.clientId;
    this.clientSecret = clientSecret || config.amazon.clientSecret;

    this.httpClient = axios.create({
      baseURL: config.amazon.apiBaseUrl,
      timeout: 60000,
      headers: {
        'Amazon-Advertising-API-ClientId': this.clientId,
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        logApiCall(
          response.config.url || '',
          response.config.method?.toUpperCase() || '',
          response.status,
          Date.now() - (response.config as any).startTime
        );
        return response;
      },
      (error: AxiosError) => {
        const status = error.response?.status || 0;
        logApiCall(
          error.config?.url || '',
          error.config?.method?.toUpperCase() || '',
          status,
          Date.now() - ((error.config as any)?.startTime || Date.now())
        );
        throw error;
      }
    );

    // Add request interceptor for timing
    this.httpClient.interceptors.request.use((config) => {
      (config as any).startTime = Date.now();
      return config;
    });
  }

  async initialize(): Promise<void> {
    await this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<void> {
    // Check cache first
    const cacheKey = `${this.profileId}:${this.refreshToken.substring(0, 10)}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      this.accessToken = cached.accessToken;
      return;
    }

    logger.info('Refreshing Amazon access token', { profileId: this.profileId });

    const response = await withRetry(
      async () =>
        axios.post<AmazonTokenResponse>(
          config.amazon.oauthUrl,
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        ),
      'OAuth token refresh'
    );

    this.accessToken = response.data.access_token;

    // Cache the token
    tokenCache.set(cacheKey, {
      accessToken: this.accessToken,
      expiresAt: Date.now() + (response.data.expires_in - 60) * 1000,
      profileId: this.profileId,
    });

    // Update http client headers
    this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    this.httpClient.defaults.headers.common['Amazon-Advertising-API-Scope'] = this.profileId;
  }

  private async ensureValidToken(): Promise<void> {
    const cacheKey = `${this.profileId}:${this.refreshToken.substring(0, 10)}`;
    const cached = tokenCache.get(cacheKey);

    if (!cached || cached.expiresAt <= Date.now() + 60000) {
      await this.refreshAccessToken();
    }
  }

  async getPortfolios(): Promise<Portfolio[]> {
    await this.ensureValidToken();

    const response = await withRetry(
      async () =>
        this.httpClient.post('/portfolios/list', {
          includeExtendedDataFields: true,
        }),
      'Get portfolios'
    );

    const portfolios: Portfolio[] = (response.data.portfolios || []).map((p: any) => ({
      portfolio_id: String(p.portfolioId),
      name: p.name,
      budget_amount: p.budget?.amount || null,
      budget_policy: p.budget?.policy || null,
      state: p.state,
    }));

    logger.info('Fetched portfolios', { count: portfolios.length });
    return portfolios;
  }

  async getCampaigns(): Promise<Campaign[]> {
    await this.ensureValidToken();

    const campaigns: Campaign[] = [];
    let nextToken: string | null = null;

    do {
      const response = await withRetry(
        async () =>
          this.httpClient.post(
            '/sp/campaigns/list',
            {
              includeExtendedDataFields: true,
              maxResults: 100,
              ...(nextToken ? { nextToken } : {}),
            },
            {
              headers: {
                'Accept': 'application/vnd.spCampaign.v3+json',
                'Content-Type': 'application/vnd.spCampaign.v3+json',
              },
            }
          ),
        'Get campaigns'
      );

      const data = response.data;
      nextToken = data.nextToken || null;

      for (const c of data.campaigns || []) {
        const placementBids = c.dynamicBidding?.placementBidding || [];

        const bidTopOfSearch = placementBids.find(
          (b: any) => b.placement === 'PLACEMENT_TOP'
        )?.percentage || 0;
        const bidRestOfSearch = placementBids.find(
          (b: any) => b.placement === 'PLACEMENT_REST_OF_SEARCH'
        )?.percentage || 0;
        const bidProductPage = placementBids.find(
          (b: any) => b.placement === 'PLACEMENT_PRODUCT_PAGE'
        )?.percentage || 0;

        campaigns.push({
          campaign_id: String(c.campaignId),
          portfolio_id: c.portfolioId ? String(c.portfolioId) : null,
          name: c.name,
          state: c.state,
          budget: c.budget?.budget || 0,
          budget_type: c.budget?.budgetType || 'DAILY',
          bidding_strategy: c.dynamicBidding?.strategy || 'LEGACY_FOR_SALES',
          bid_top_of_search: bidTopOfSearch,
          bid_rest_of_search: bidRestOfSearch,
          bid_product_page: bidProductPage,
        });
      }

      // Rate limiting
      await sleep(config.rateLimiting.apiDelay);
    } while (nextToken);

    logger.info('Fetched campaigns', { count: campaigns.length });
    return campaigns;
  }

  async createReport(reportConfig: ReportConfig): Promise<string> {
    await this.ensureValidToken();

    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - 1); // Yesterday

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - reportConfig.lookBack);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const reportName = `${reportConfig.name} - ${timestamp}`;

    const columns = [
      'campaignId',
      'campaignName',
      'impressions',
      'clicks',
      'cost',
      'sales14d',
      'purchases14d',
    ];

    // Add placement column if this is a placement report
    if (reportConfig.groupBy.includes('campaignPlacement')) {
      columns.push('placementClassification');
    }

    const payload = {
      name: reportName,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      configuration: {
        adProduct: 'SPONSORED_PRODUCTS',
        groupBy: reportConfig.groupBy,
        columns,
        reportTypeId: reportConfig.reportTypeId,
        timeUnit: reportConfig.timeUnit,
        format: 'GZIP_JSON',
      },
    };

    const response = await withRetry(
      async () => this.httpClient.post('/reporting/reports', payload),
      'Create report'
    );

    const reportId = response.data.reportId;
    logger.info('Created report request', {
      reportName,
      reportId,
      lookBack: reportConfig.lookBack,
    });

    return reportId;
  }

  async getReportStatus(reportId: string): Promise<AmazonReportResponse> {
    await this.ensureValidToken();

    const response = await withRetry(
      async () => this.httpClient.get(`/reporting/reports/${reportId}`),
      'Get report status'
    );

    return {
      reportId: response.data.reportId,
      status: response.data.status,
      statusDetails: response.data.statusDetails,
      url: response.data.url,
    };
  }

  async downloadReport(downloadUrl: string): Promise<any[]> {
    logger.info('Downloading report', { url: downloadUrl.substring(0, 50) + '...' });

    const response = await withRetry(
      async () =>
        axios.get(downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 120000,
        }),
      'Download report'
    );

    // Decompress gzip
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gunzip = createGunzip();

      gunzip.on('data', (chunk: Buffer) => chunks.push(chunk));
      gunzip.on('end', () => {
        try {
          const jsonString = Buffer.concat(chunks).toString('utf-8');
          const data = JSON.parse(jsonString);
          logger.info('Downloaded and parsed report', { rowCount: data.length });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      });
      gunzip.on('error', reject);

      gunzip.write(response.data);
      gunzip.end();
    });
  }
}

// Helper to normalize report row data
export function normalizeMetrics(row: any): {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  purchases: number;
} {
  return {
    impressions: row.impressions ?? 0,
    clicks: row.clicks ?? 0,
    spend: parseFloat(row.cost ?? '0'),
    sales: parseFloat(row.sales14d ?? '0'),
    purchases: row.purchases14d ?? 0,
  };
}

// Calculate ACOS
export function calculateAcos(spend: number, sales: number): string {
  if (sales <= 0) return '0.00';
  return ((spend / sales) * 100).toFixed(2);
}

// Calculate CVR
export function calculateCvr(clicks: number, purchases: number): string {
  if (clicks <= 0) return '0.0000';
  return (purchases / clicks).toFixed(4);
}
