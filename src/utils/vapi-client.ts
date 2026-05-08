import axios from 'axios';
import { Logger } from './logger.js';

// Diagnostic helper to classify network errors
function classifyNetworkError(error: any): {
  type: 'TLS_ERROR' | 'TIMEOUT' | 'DNS_ERROR' | 'CONNECTION_REFUSED' | 'SOCKET_HANGUP' | 'API_ERROR' | 'UNKNOWN';
  description: string;
  suggestion: string;
} {
  const message = error.message || '';
  const code = error.code || '';
  
  if (message.includes('TLS') || message.includes('SSL') || message.includes('certificate') || message.includes('secure')) {
    return {
      type: 'TLS_ERROR',
      description: 'TLS/SSL handshake failed before connection was established',
      suggestion: 'Check if Vapi API allows connections from Vercel IPs. The serverless function may be blocked.',
    };
  }
  
  if (code === 'ECONNABORTED' || message.includes('timeout')) {
    return {
      type: 'TIMEOUT',
      description: 'Request timed out waiting for response',
      suggestion: 'Increase timeout or check if Vapi API is responding slowly.',
    };
  }
  
  if (code === 'ENOTFOUND' || message.includes('getaddrinfo')) {
    return {
      type: 'DNS_ERROR',
      description: 'DNS resolution failed - could not resolve hostname',
      suggestion: 'Check VAPI_API_BASE_URL is correct (should be https://api.vapi.ai)',
    };
  }
  
  if (code === 'ECONNREFUSED') {
    return {
      type: 'CONNECTION_REFUSED',
      description: 'Connection was refused by the server',
      suggestion: 'The Vapi API server is not accepting connections. May be down or blocking this IP.',
    };
  }
  
  if (message.includes('socket hang up') || message.includes('disconnected')) {
    return {
      type: 'SOCKET_HANGUP',
      description: 'Connection was closed unexpectedly by the server',
      suggestion: 'Server closed connection before completing. May be IP blocked or rate limited.',
    };
  }
  
  if (error.response) {
    return {
      type: 'API_ERROR',
      description: `API returned error status ${error.response.status}`,
      suggestion: 'Check API key is valid and has correct permissions.',
    };
  }
  
  return {
    type: 'UNKNOWN',
    description: message,
    suggestion: 'Unknown error type. Check full error logs.',
  };
}

export class VapiApiClient {
  private client: any;
  private apiKey: string;
  private baseURL: string;
  private isConfigValid: boolean;

  constructor() {
    this.apiKey = process.env.VAPI_API_KEY || '';
    this.baseURL = process.env.VAPI_API_BASE_URL || 'https://api.vapi.ai';
    
    // Validate configuration on startup
    this.isConfigValid = this.validateConfig();
    
    // Log configuration status (without exposing full API key)
    Logger.info('[VAPI_CLIENT] Initializing client', {
      baseURL: this.baseURL,
      apiKeyLength: this.apiKey.length,
      apiKeyPrefix: this.apiKey.substring(0, 10) + '...',
      isConfigValid: this.isConfigValid,
      environment: process.env.NODE_ENV,
      isVercel: process.env.VERCEL === '1',
    });
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use((config: any) => {
      Logger.info('[VAPI_CLIENT] API request initiated', {
        method: config.method?.toUpperCase(),
        url: config.url,
        fullUrl: `${config.baseURL}${config.url}`,
        timeout: config.timeout,
      });
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response: any) => {
        Logger.info('[VAPI_CLIENT] API request successful', {
          status: response.status,
          url: response.config.url,
          responseTime: response.headers?.['x-response-time'],
        });
        return response;
      },
      (error: any) => {
        const diagnostic = classifyNetworkError(error);
        Logger.error('[VAPI_CLIENT] API request failed with diagnostic', {
          url: error.config?.url,
          fullUrl: error.config ? `${error.config.baseURL}${error.config.url}` : 'unknown',
          errorType: diagnostic.type,
          errorDescription: diagnostic.description,
          suggestion: diagnostic.suggestion,
          originalMessage: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  private validateConfig(): boolean {
    const issues: string[] = [];
    
    if (!this.apiKey) {
      issues.push('VAPI_API_KEY is empty or not set');
    } else if (this.apiKey.length < 20) {
      issues.push('VAPI_API_KEY seems too short - may be truncated');
    }
    
    if (!this.baseURL) {
      issues.push('VAPI_API_BASE_URL is empty');
    } else if (!this.baseURL.startsWith('https://')) {
      issues.push('VAPI_API_BASE_URL should start with https://');
    }
    
    if (issues.length > 0) {
      Logger.error('[VAPI_CLIENT] Configuration issues detected', { issues });
      return false;
    }
    
    return true;
  }

  // Test connection to Vapi API without making a real call
  async testConnection(): Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
    diagnostic?: ReturnType<typeof classifyNetworkError>;
  }> {
    const startTime = Date.now();
    
    Logger.info('[VAPI_CLIENT] Testing connection to Vapi API', {
      baseURL: this.baseURL,
      isConfigValid: this.isConfigValid,
    });
    
    try {
      // Try to make a simple authenticated request
      // Using a non-existent call ID to test auth without side effects
      const response = await this.client.get('/call/test-connection-check', {
        timeout: 10000, // Shorter timeout for test
        validateStatus: (status: number) => status < 500, // Accept 4xx as "connection works"
      });
      
      const latencyMs = Date.now() - startTime;
      
      Logger.info('[VAPI_CLIENT] Connection test completed', {
        status: response.status,
        latencyMs,
        // 404 means connection works, just call doesn't exist
        connectionWorks: response.status === 404 || response.status === 200,
      });
      
      return {
        success: true,
        latencyMs,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      const diagnostic = classifyNetworkError(error);
      
      Logger.error('[VAPI_CLIENT] Connection test failed', {
        latencyMs,
        diagnostic,
        originalError: error.message,
      });
      
      return {
        success: false,
        latencyMs,
        error: error.message,
        diagnostic,
      };
    }
  }

  // Get configuration status for debugging
  getConfigStatus(): {
    baseURL: string;
    apiKeyConfigured: boolean;
    apiKeyLength: number;
    isConfigValid: boolean;
    environment: string;
    isVercel: boolean;
  } {
    return {
      baseURL: this.baseURL,
      apiKeyConfigured: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      isConfigValid: this.isConfigValid,
      environment: process.env.NODE_ENV || 'unknown',
      isVercel: process.env.VERCEL === '1',
    };
  }

  async getCall(callId: string): Promise<any> {
    // Check config before making request
    if (!this.isConfigValid) {
      Logger.error('[VAPI_CLIENT] Cannot make request - invalid configuration', {
        callId,
        configStatus: this.getConfigStatus(),
      });
      throw new Error('Vapi client not properly configured. Check VAPI_API_KEY and VAPI_API_BASE_URL.');
    }
    
    try {
      Logger.info('[VAPI_CLIENT] Fetching call data', { 
        callId,
        fullUrl: `${this.baseURL}/call/${callId}`,
      });
      
      const response = await this.client.get(`/call/${callId}`);
      
      Logger.info('[VAPI_CLIENT] Call data retrieved successfully', {
        callId,
        hasMetadata: !!response.data?.metadata,
        hasGhlMetadata: !!response.data?.metadata?.ghl,
      });
      
      return response.data;
    } catch (error: any) {
      const diagnostic = classifyNetworkError(error);
      
      Logger.error('[VAPI_CLIENT] Failed to get call data', {
        callId,
        errorType: diagnostic.type,
        errorDescription: diagnostic.description,
        suggestion: diagnostic.suggestion,
        originalError: error.message,
        code: error.code,
      });
      
      throw new Error(`Failed to get call: ${diagnostic.type} - ${diagnostic.description}`);
    }
  }

  async getCallMetadata(callId: string): Promise<any> {
    try {
      Logger.info('[VAPI_CLIENT] Fetching call metadata specifically', { callId });

      const callData = await this.getCall(callId);
      const metadata = callData?.metadata || {};
      const ghlMetadata = metadata?.ghl || null;

      // Extract structured outputs from artifact (e.g. "Call Summary" schema)
      const structuredOutputs = callData?.artifact?.structuredOutputs || null;
      let structuredSummary: string | null = null;
      if (structuredOutputs && typeof structuredOutputs === 'object') {
        for (const output of Object.values(structuredOutputs) as any[]) {
          if (typeof output?.result === 'string' && output.result.length > 0) {
            structuredSummary = output.result;
            break;
          }
        }
      }

      // Fallback: use standard analysis summary if structured outputs had nothing
      if (!structuredSummary && callData?.analysis?.summary) {
        structuredSummary = callData.analysis.summary;
      }

      Logger.info('[VAPI_CLIENT] Call metadata extracted', {
        callId,
        hasMetadata: Object.keys(metadata).length > 0,
        hasGhlMetadata: !!ghlMetadata,
        ghlKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
        hasStructuredSummary: !!structuredSummary,
      });

      return {
        metadata,
        ghlMetadata,
        fullCall: callData,
        structuredSummary,
      };
    } catch (error) {
      Logger.error('[VAPI_CLIENT] Failed to get call metadata', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}