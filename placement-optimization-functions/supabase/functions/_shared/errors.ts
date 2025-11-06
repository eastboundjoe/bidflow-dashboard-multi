// =====================================================
// Error Handling Utilities
// =====================================================

export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export class AmazonAdsAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'AmazonAdsAPIError'
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Format error for logging and storage
 */
export function formatError(error: unknown): {
  message: string
  code?: string
  details?: unknown
} {
  if (error instanceof WorkflowError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details
    }
  }

  if (error instanceof AmazonAdsAPIError) {
    return {
      message: error.message,
      code: `AMAZON_API_${error.statusCode}`,
      details: error.response
    }
  }

  if (error instanceof DatabaseError) {
    return {
      message: error.message,
      code: `DB_ERROR_${error.operation}`,
      details: error.details
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR'
    }
  }

  return {
    message: String(error),
    code: 'UNKNOWN_ERROR'
  }
}

/**
 * Retry utility for API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      console.log(`Attempt ${attempt} failed:`, formatError(error))

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt - 1) // Exponential backoff
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
