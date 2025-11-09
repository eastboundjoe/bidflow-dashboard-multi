// =====================================================
// Amazon Ads API Client - Multi-Tenant Version
// =====================================================
// Handles OAuth token management and API requests
// Accepts credentials in constructor (multi-tenant support)
// =====================================================

export interface AmazonAdsConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

/**
 * Amazon Ads API Client - Multi-Tenant
 * Accepts credentials in constructor instead of loading from vault
 */
export class AmazonAdsClient {
  private accessToken: string | null = null
  private tokenExpiresAt: number | null = null
  private config: AmazonAdsConfig

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.config = {
      clientId,
      clientSecret,
      refreshToken
    }
  }

  /**
   * Get valid access token (refreshes if expired)
   */
  async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now()
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > now + 300000) {
      return this.accessToken
    }

    // Refresh token
    await this.refreshAccessToken()

    if (!this.accessToken) {
      throw new Error('Failed to obtain access token')
    }

    return this.accessToken
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken() {
    const tokenUrl = 'https://api.amazon.com/auth/o2/token'

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.config.refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
    }

    const tokenData: TokenResponse = await response.json()
    this.accessToken = tokenData.access_token
    this.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000)

    console.log('✅ Access token refreshed')
  }

  /**
   * Make GET request to Amazon Ads API
   */
  async get(url: string, headers: Record<string, string> = {}) {
    const accessToken = await this.getAccessToken()

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': this.config.clientId,
        'Content-Type': 'application/json',
        ...headers
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API GET failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }

  /**
   * Make POST request to Amazon Ads API
   */
  async post(url: string, body: any, headers: Record<string, string> = {}) {
    const accessToken = await this.getAccessToken()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': this.config.clientId,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API POST failed: ${response.status} - ${errorText}`)
    }

    return await response.json()
  }
}
