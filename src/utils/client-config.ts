// Load environment variables FIRST (this module is imported early in the chain)
import dotenv from 'dotenv';
dotenv.config();

import { Logger } from './logger.js';

/**
 * Client Configuration Interface
 */
export interface ClientConfig {
  name: string;
  assistantId: string;
  ghlApiKey: string;
  slackChannelId?: string;
}

/**
 * Client Configuration Manager
 * Maps VAPI Assistant IDs to their respective GHL API keys and configurations
 */
export class ClientConfigManager {
  private static configs: Map<string, ClientConfig> = new Map();

  /**
   * Initialize client configurations from environment variables
   */
  static initialize(): void {
    // Define all clients with their environment variable names
    const clientDefinitions = [
      {
        name: 'Premier Wellness',
        assistantIdVar: 'PREMIER_WELLNESS_ASSISTANT_ID',
        apiKeyVar: 'PREMIER_WELLNESS_GHL_API_KEY',
        slackChannelVar: 'SLACK_CHANNEL_ID_PREMIER_WELLNESS',
      },
      {
        name: 'West Texas',
        assistantIdVar: 'WEST_TEXAS_ASSISTANT_ID',
        apiKeyVar: 'WEST_TEXAS_GHL_API_KEY',
        slackChannelVar: 'SLACK_CHANNEL_ID_WEST_TEXAS',
      },
      {
        name: 'Third Client',
        assistantIdVar: 'THIRD_CLIENT_ASSISTANT_ID',
        apiKeyVar: 'THIRD_CLIENT_GHL_API_KEY',
        slackChannelVar: 'SLACK_CHANNEL_ID_THIRD_CLIENT',
      },
      {
        name: 'Data Driven Practices',
        assistantIdVar: 'DATA_DRIVEN_PRACTICES_ASSISTANT_ID',
        apiKeyVar: 'DATA_DRIVEN_PRACTICES_GHL_API_KEY',
        slackChannelVar: 'SLACK_CHANNEL_ID_DATA_DRIVEN_PRACTICES',
      },
      {
        name: 'NuVive',
        assistantIdVar: 'NUVIVE_ASSISTANT_ID',
        apiKeyVar: 'NUVIVE_GHL_API_KEY',
        slackChannelVar: 'SLACK_CHANNEL_ID_NUVIVE',
      },
    ];

    const missingConfigs: string[] = [];
    const configuredClients: string[] = [];

    // Load each client configuration from environment variables
    for (const clientDef of clientDefinitions) {
      const assistantId = process.env[clientDef.assistantIdVar];
      const apiKey = process.env[clientDef.apiKeyVar];

      // Check if both required variables are set
      if (!assistantId || !apiKey) {
        Logger.warn(`[CLIENT_CONFIG] Missing configuration for ${clientDef.name}`, {
          assistantIdSet: !!assistantId,
          apiKeySet: !!apiKey,
          requiredVars: [clientDef.assistantIdVar, clientDef.apiKeyVar],
        });
        missingConfigs.push(clientDef.name);
        continue;
      }

      // Create client configuration
      const config: ClientConfig = {
        name: clientDef.name,
        assistantId,
        ghlApiKey: apiKey,
      };

      // Add optional Slack channel if configured
      const slackChannel = process.env[clientDef.slackChannelVar];
      if (slackChannel) {
        config.slackChannelId = slackChannel;
      }

      // Register the configuration
      this.configs.set(assistantId, config);
      configuredClients.push(clientDef.name);

      Logger.debug(`[CLIENT_CONFIG] Loaded configuration for ${clientDef.name}`, {
        assistantId: assistantId.substring(0, 8) + '...',
        apiKeyPrefix: apiKey.substring(0, 10) + '...',
        hasSlackChannel: !!slackChannel,
      });
    }

    // Log initialization summary
    if (this.configs.size === 0) {
      Logger.error('[CLIENT_CONFIG] No client configurations loaded! Check environment variables.', {
        missingConfigs,
      });
    } else {
      Logger.info('[CLIENT_CONFIG] Initialized client configurations', {
        clientCount: this.configs.size,
        configuredClients,
        missingConfigs: missingConfigs.length > 0 ? missingConfigs : undefined,
      });
    }
  }

  /**
   * Get client configuration by Assistant ID
   */
  static getConfigByAssistantId(assistantId: string): ClientConfig | null {
    const config = this.configs.get(assistantId);
    
    if (!config) {
      Logger.warn('[CLIENT_CONFIG] No configuration found for Assistant ID', {
        assistantId,
        availableAssistants: Array.from(this.configs.keys()),
      });
      return null;
    }

    Logger.info('[CLIENT_CONFIG] Configuration retrieved', {
      assistantId,
      clientName: config.name,
    });

    return config;
  }

  /**
   * Get GHL API Key by Assistant ID
   */
  static getGHLApiKey(assistantId: string): string | null {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.ghlApiKey || null;
  }

  /**
   * Get client name by Assistant ID
   */
  static getClientName(assistantId: string): string {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.name || 'Unknown Client';
  }

  /**
   * Get Slack Channel ID by Assistant ID
   */
  static getSlackChannelId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.slackChannelId;
  }

  /**
   * Get all configured clients
   */
  static getAllClients(): ClientConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Check if Assistant ID is configured
   */
  static isConfigured(assistantId: string): boolean {
    return this.configs.has(assistantId);
  }
}

// Initialize configurations on module load
ClientConfigManager.initialize();

