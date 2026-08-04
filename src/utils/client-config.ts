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
  calendarId?: string;
  backNeckCalendarId?: string;
  callbackCalendarId?: string;
  gabrielCalendarId?: string;
  guideWorkflowId?: string;
  backNeckGuideWorkflowId?: string;
  locationId?: string;
  slackChannelId?: string;
  // send_text_link: link variants keyed by uppercase linkKey ('DEFAULT', 'VIP', ...)
  smsLinkUrls?: Record<string, string>;
  smsLinkMessages?: Record<string, string>;
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
        calendarIdVar: 'PREMIER_WELLNESS_CALENDAR_ID',
        locationIdVar: 'PREMIER_WELLNESS_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_PREMIER_WELLNESS',
      },
      {
        name: 'West Texas',
        assistantIdVar: 'WEST_TEXAS_ASSISTANT_ID',
        apiKeyVar: 'WEST_TEXAS_GHL_API_KEY',
        calendarIdVar: 'WEST_TEXAS_CALENDAR_ID',
        locationIdVar: 'WEST_TEXAS_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_WEST_TEXAS',
      },
      {
        name: 'West Texas Back Neck',
        assistantIdVar: 'WEST_TEXAS_BACK_NECK_ASSISTANT_ID',
        apiKeyVar: 'WEST_TEXAS_BACK_NECK_GHL_API_KEY',
        calendarIdVar: 'WEST_TEXAS_BACK_NECK_CALENDAR_ID',
        locationIdVar: 'WEST_TEXAS_BACK_NECK_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_WEST_TEXAS_BACK_NECK',
      },
      {
        name: 'Jennings',
        assistantIdVar: 'THIRD_CLIENT_ASSISTANT_ID',
        apiKeyVar: 'THIRD_CLIENT_GHL_API_KEY',
        calendarIdVar: 'THIRD_CLIENT_CALENDAR_ID',
        locationIdVar: 'THIRD_CLIENT_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_THIRD_CLIENT',
      },
      {
        name: 'Data Driven Practices',
        assistantIdVar: 'DATA_DRIVEN_PRACTICES_ASSISTANT_ID',
        apiKeyVar: 'DATA_DRIVEN_PRACTICES_GHL_API_KEY',
        calendarIdVar: 'DATA_DRIVEN_PRACTICES_CALENDAR_ID',
        locationIdVar: 'DATA_DRIVEN_PRACTICES_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_DATA_DRIVEN_PRACTICES',
      },
      {
        name: 'NuVive',
        assistantIdVar: 'NUVIVE_ASSISTANT_ID',
        apiKeyVar: 'NUVIVE_GHL_API_KEY',
        calendarIdVar: 'NUVIVE_CALENDAR_ID',
        locationIdVar: 'NUVIVE_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_NUVIVE',
      },
      {
        name: 'NuVive Back Neck',
        assistantIdVar: 'NUVIVE_BACK_NECK_ASSISTANT_ID',
        apiKeyVar: 'NUVIVE_BACK_NECK_GHL_API_KEY',
        calendarIdVar: 'NUVIVE_BACK_NECK_CALENDAR_ID',
        locationIdVar: 'NUVIVE_BACK_NECK_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_NUVIVE_BACK_NECK',
      },
      {
        name: 'Jennings Back Neck',
        assistantIdVar: 'JENNINGS_BACK_NECK_ASSISTANT_ID',
        apiKeyVar: 'JENNINGS_BACK_NECK_GHL_API_KEY',
        calendarIdVar: 'JENNINGS_BACK_NECK_CALENDAR_ID',
        locationIdVar: 'JENNINGS_BACK_NECK_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_JENNINGS_BACK_NECK',
      },
      {
        name: 'NuWave',
        assistantIdVar: 'NUWAVE_ASSISTANT_ID',
        apiKeyVar: 'NUWAVE_GHL_API_KEY',
        calendarIdVar: 'NUWAVE_CALENDAR_ID',
        locationIdVar: 'NUWAVE_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_NUWAVE',
      },
      {
        name: 'Amplify Life Baldwin',
        assistantIdVar: 'AMPLIFY_LIFE_BALDWIN_ASSISTANT_ID',
        apiKeyVar: 'AMPLIFY_LIFE_BALDWIN_GHL_API_KEY',
        calendarIdVar: 'AMPLIFY_LIFE_BALDWIN_CALENDAR_ID',
        locationIdVar: 'AMPLIFY_LIFE_BALDWIN_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_AMPLIFY_LIFE_BALDWIN',
      },
      {
        name: 'Miami Valley',
        assistantIdVar: 'MIAMI_VALLEY_ASSISTANT_ID',
        apiKeyVar: 'MIAMI_VALLEY_GHL_API_KEY',
        calendarIdVar: 'MIAMI_VALLEY_CALENDAR_ID',
        calendarIdCallbackVar: 'MIAMI_VALLEY_CALLBACK_CALENDAR_ID',
        locationIdVar: 'MIAMI_VALLEY_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_MIAMI_VALLEY',
      },
      {
        // Single frontdesk assistant handles BOTH programs. program_tag on the
        // calendar/schedule tools routes to the neuropathy (main) or back-neck
        // calendar; send_text_guide routes to the matching guide workflow.
        name: 'Miami Valley Frontdesk',
        assistantIdVar: 'MIAMI_VALLEY_FRONTDESK_ASSISTANT_ID',
        apiKeyVar: 'MIAMI_VALLEY_FRONTDESK_GHL_API_KEY',
        calendarIdVar: 'MIAMI_VALLEY_FRONTDESK_CALENDAR_ID',
        calendarIdBackNeckVar: 'MIAMI_VALLEY_FRONTDESK_BACK_NECK_CALENDAR_ID',
        calendarIdCallbackVar: 'MIAMI_VALLEY_FRONTDESK_CALLBACK_CALENDAR_ID',
        guideWorkflowIdVar: 'MIAMI_VALLEY_FRONTDESK_NEURO_GUIDE_WF',
        guideWorkflowIdBackNeckVar: 'MIAMI_VALLEY_FRONTDESK_BACK_NECK_GUIDE_WF',
        locationIdVar: 'MIAMI_VALLEY_FRONTDESK_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_MIAMI_VALLEY_FRONTDESK',
      },
      {
        name: 'Amplify Life Dallas',
        assistantIdVar: 'AMPLIFY_LIFE_DALLAS_ASSISTANT_ID',
        apiKeyVar: 'AMPLIFY_LIFE_DALLAS_GHL_API_KEY',
        calendarIdVar: 'AMPLIFY_LIFE_DALLAS_CALENDAR_ID',
        calendarIdCallbackVar: 'AMPLIFY_LIFE_DALLAS_CALLBACK_CALENDAR_ID',
        locationIdVar: 'AMPLIFY_LIFE_DALLAS_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_AMPLIFY_LIFE_DALLAS',
      },
      {
        name: 'Chiromedix',
        assistantIdVar: 'CHIROMEDIX_ASSISTANT_ID',
        apiKeyVar: 'CHIROMEDIX_GHL_API_KEY',
        calendarIdVar: 'CHIROMEDIX_CALENDAR_ID',
        locationIdVar: 'CHIROMEDIX_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_CHIROMEDIX',
      },
      {
        name: 'Florida Neuropathy & Knee Pain Center',
        assistantIdVar: 'FLORIDA_NEUROPATHY_ASSISTANT_ID',
        apiKeyVar: 'FLORIDA_NEUROPATHY_GHL_API_KEY',
        calendarIdVar: 'FLORIDA_NEUROPATHY_CALENDAR_ID',
        locationIdVar: 'FLORIDA_NEUROPATHY_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_FLORIDA_NEUROPATHY',
      },
      {
        name: 'Performance Sport and Spine Back',
        assistantIdVar: 'PERFORMANCE_SPORT_SPINE_BACK_ASSISTANT_ID',
        apiKeyVar: 'PERFORMANCE_SPORT_SPINE_BACK_GHL_API_KEY',
        calendarIdVar: 'PERFORMANCE_SPORT_SPINE_BACK_CALENDAR_ID',
        locationIdVar: 'PERFORMANCE_SPORT_SPINE_BACK_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_PERFORMANCE_SPORT_SPINE_BACK',
      },
      {
        name: 'DDP',
        assistantIdVar: 'DDP_ASSISTANT_ID',
        apiKeyVar: 'DDP_GHL_API_KEY',
        calendarIdVar: 'DDP_CALENDAR_ID',
        calendarIdCallbackVar: 'DDP_CALLBACK_CALENDAR_ID',
        calendarIdGabrielVar: 'DDP_GABRIEL_CALENDAR_ID',
        locationIdVar: 'DDP_LOCATION_ID',
        slackChannelVar: 'SLACK_CHANNEL_ID_DDP',
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

      // Add optional calendar ID if configured
      const calendarId = process.env[clientDef.calendarIdVar];
      if (calendarId) {
        config.calendarId = calendarId;
      }

      // Add optional back-neck calendar ID if configured (program_tag routing)
      if ('calendarIdBackNeckVar' in clientDef && clientDef.calendarIdBackNeckVar) {
        const backNeckCalendarId = process.env[clientDef.calendarIdBackNeckVar];
        if (backNeckCalendarId) {
          config.backNeckCalendarId = backNeckCalendarId;
        }
      }

      // Add optional callback calendar ID if configured
      if ('calendarIdCallbackVar' in clientDef && clientDef.calendarIdCallbackVar) {
        const callbackCalendarId = process.env[clientDef.calendarIdCallbackVar];
        if (callbackCalendarId) {
          config.callbackCalendarId = callbackCalendarId;
        }
      }

      // Add optional Gabriel calendar ID if configured (DDP routing for <$40K collections)
      if ('calendarIdGabrielVar' in clientDef && clientDef.calendarIdGabrielVar) {
        const gabrielCalendarId = process.env[clientDef.calendarIdGabrielVar];
        if (gabrielCalendarId) {
          config.gabrielCalendarId = gabrielCalendarId;
        }
      }

      // Add optional guide workflow ID if configured (send_text_guide — neuropathy/default)
      if ('guideWorkflowIdVar' in clientDef && clientDef.guideWorkflowIdVar) {
        const guideWorkflowId = process.env[clientDef.guideWorkflowIdVar];
        if (guideWorkflowId) {
          config.guideWorkflowId = guideWorkflowId;
        }
      }

      // Add optional back-neck guide workflow ID if configured (send_text_guide — back & neck)
      if ('guideWorkflowIdBackNeckVar' in clientDef && clientDef.guideWorkflowIdBackNeckVar) {
        const backNeckGuideWorkflowId = process.env[clientDef.guideWorkflowIdBackNeckVar];
        if (backNeckGuideWorkflowId) {
          config.backNeckGuideWorkflowId = backNeckGuideWorkflowId;
        }
      }

      // Add optional location ID if configured
      if (clientDef.locationIdVar) {
        const locationId = process.env[clientDef.locationIdVar];
        if (locationId) {
          config.locationId = locationId;
        }
      }

      // Add optional send_text_link variants. Rather than declaring a var per
      // client, derive the client's env prefix and pick up every
      // <PREFIX>_SMS_LINK[_<KEY>]_URL / _MESSAGE pair — same naming the
      // outbound server uses, so the identical env vars work here.
      const smsPrefix = clientDef.assistantIdVar.replace(/_ASSISTANT_ID$/, '');
      const smsLinkPattern = new RegExp(`^${smsPrefix}_SMS_LINK_(?:(.+)_)?(URL|MESSAGE)$`);
      for (const [envKey, envValue] of Object.entries(process.env)) {
        if (!envValue) continue;
        const match = smsLinkPattern.exec(envKey);
        if (!match) continue;
        const linkKey = (match[1] || 'DEFAULT').toUpperCase();
        if (match[2] === 'URL') {
          config.smsLinkUrls = { ...config.smsLinkUrls, [linkKey]: envValue };
        } else {
          config.smsLinkMessages = { ...config.smsLinkMessages, [linkKey]: envValue };
        }
      }

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
        hasCalendarId: !!calendarId,
        hasSlackChannel: !!slackChannel,
      });
    }

    // Register alias assistant IDs that share the same configuration
    // Premier Wellness Back Neck uses the same config as Premier Wellness
    const premierWellnessAssistantId = process.env['PREMIER_WELLNESS_ASSISTANT_ID'];
    const premierWellnessBackNeckAssistantId = process.env['PREMIER_WELLNESS_BACK_NECK_ASSISTANT_ID'];
    
    if (premierWellnessAssistantId && premierWellnessBackNeckAssistantId) {
      const premierConfig = this.configs.get(premierWellnessAssistantId);
      if (premierConfig) {
        // Create a copy with ALL properties from Premier Wellness, explicitly copying each property
        const aliasConfig: ClientConfig = {
          name: 'Premier Wellness Back Neck',
          assistantId: premierWellnessBackNeckAssistantId,
          ghlApiKey: premierConfig.ghlApiKey,
        };
        
        // Copy optional properties only if they exist
        if (premierConfig.calendarId) {
          aliasConfig.calendarId = premierConfig.calendarId;
        }
        if (premierConfig.locationId) {
          aliasConfig.locationId = premierConfig.locationId;
        }
        if (premierConfig.slackChannelId) {
          aliasConfig.slackChannelId = premierConfig.slackChannelId;
        }
        if (premierConfig.smsLinkUrls) {
          aliasConfig.smsLinkUrls = premierConfig.smsLinkUrls;
        }
        if (premierConfig.smsLinkMessages) {
          aliasConfig.smsLinkMessages = premierConfig.smsLinkMessages;
        }

        this.configs.set(premierWellnessBackNeckAssistantId, aliasConfig);
        configuredClients.push('Premier Wellness Back Neck (alias)');
        
        Logger.info('[CLIENT_CONFIG] Registered alias: Premier Wellness Back Neck -> Premier Wellness', {
          aliasAssistantId: premierWellnessBackNeckAssistantId.substring(0, 8) + '...',
          parentAssistantId: premierWellnessAssistantId.substring(0, 8) + '...',
          hasGhlApiKey: !!aliasConfig.ghlApiKey,
          hasCalendarId: !!aliasConfig.calendarId,
          hasLocationId: !!aliasConfig.locationId,
          hasSlackChannelId: !!aliasConfig.slackChannelId,
        });
      } else {
        Logger.warn('[CLIENT_CONFIG] Cannot create alias: Premier Wellness config not found', {
          premierWellnessAssistantId: premierWellnessAssistantId.substring(0, 8) + '...',
        });
      }
    }

    // Register Inbound Default assistant as alias of Premier Wellness
    const inboundDefaultAssistantId = process.env['VAPI_ASSISTANT_DEFAULT_ID'];
    if (inboundDefaultAssistantId && premierWellnessAssistantId) {
      const premierConfig = this.configs.get(premierWellnessAssistantId);
      if (premierConfig && !this.configs.has(inboundDefaultAssistantId)) {
        const inboundConfig: ClientConfig = {
          name: 'Premier Inbound Neuro',
          assistantId: inboundDefaultAssistantId,
          ghlApiKey: premierConfig.ghlApiKey,
        };
        if (premierConfig.calendarId) inboundConfig.calendarId = premierConfig.calendarId;
        if (premierConfig.locationId) inboundConfig.locationId = premierConfig.locationId;
        if (premierConfig.slackChannelId) inboundConfig.slackChannelId = premierConfig.slackChannelId;
        if (premierConfig.smsLinkUrls) inboundConfig.smsLinkUrls = premierConfig.smsLinkUrls;
        if (premierConfig.smsLinkMessages) inboundConfig.smsLinkMessages = premierConfig.smsLinkMessages;

        this.configs.set(inboundDefaultAssistantId, inboundConfig);
        configuredClients.push('Premier Inbound Neuro (alias)');

        Logger.info('[CLIENT_CONFIG] Registered alias: Premier Inbound Neuro -> Premier Wellness', {
          aliasAssistantId: inboundDefaultAssistantId.substring(0, 8) + '...',
          parentAssistantId: premierWellnessAssistantId.substring(0, 8) + '...',
          hasGhlApiKey: !!inboundConfig.ghlApiKey,
          hasCalendarId: !!inboundConfig.calendarId,
          hasLocationId: !!inboundConfig.locationId,
          hasSlackChannelId: !!inboundConfig.slackChannelId,
        });
      }
    }

    // Register Miami Valley Back Inbound as alias of Miami Valley
    const miamiValleyAssistantId = process.env['MIAMI_VALLEY_ASSISTANT_ID'];
    const miamiValleyBackInboundAssistantId = process.env['MIAMI_VALLEY_BACK_INBOUND_ASSISTANT_ID'];
    if (miamiValleyAssistantId && miamiValleyBackInboundAssistantId) {
      const miamiValleyConfig = this.configs.get(miamiValleyAssistantId);
      if (miamiValleyConfig && !this.configs.has(miamiValleyBackInboundAssistantId)) {
        const miamiValleyBackInboundConfig: ClientConfig = {
          name: 'Miami Valley Back Inbound',
          assistantId: miamiValleyBackInboundAssistantId,
          ghlApiKey: miamiValleyConfig.ghlApiKey,
        };
        if (miamiValleyConfig.calendarId) miamiValleyBackInboundConfig.calendarId = miamiValleyConfig.calendarId;
        if (miamiValleyConfig.callbackCalendarId) miamiValleyBackInboundConfig.callbackCalendarId = miamiValleyConfig.callbackCalendarId;
        if (miamiValleyConfig.locationId) miamiValleyBackInboundConfig.locationId = miamiValleyConfig.locationId;
        if (miamiValleyConfig.slackChannelId) miamiValleyBackInboundConfig.slackChannelId = miamiValleyConfig.slackChannelId;
        if (miamiValleyConfig.smsLinkUrls) miamiValleyBackInboundConfig.smsLinkUrls = miamiValleyConfig.smsLinkUrls;
        if (miamiValleyConfig.smsLinkMessages) miamiValleyBackInboundConfig.smsLinkMessages = miamiValleyConfig.smsLinkMessages;

        this.configs.set(miamiValleyBackInboundAssistantId, miamiValleyBackInboundConfig);
        configuredClients.push('Miami Valley Back Inbound (alias)');

        Logger.info('[CLIENT_CONFIG] Registered alias: Miami Valley Back Inbound -> Miami Valley', {
          aliasAssistantId: miamiValleyBackInboundAssistantId.substring(0, 8) + '...',
          parentAssistantId: miamiValleyAssistantId.substring(0, 8) + '...',
          hasGhlApiKey: !!miamiValleyBackInboundConfig.ghlApiKey,
          hasCalendarId: !!miamiValleyBackInboundConfig.calendarId,
          hasLocationId: !!miamiValleyBackInboundConfig.locationId,
          hasSlackChannelId: !!miamiValleyBackInboundConfig.slackChannelId,
        });
      }
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
   * Get the send_text_link URL and lead-in message for a client.
   * Omit linkKey for the client's default link.
   */
  static getSmsLink(assistantId: string, linkKey?: string): { url?: string | undefined; message?: string | undefined } {
    const config = this.getConfigByAssistantId(assistantId);
    if (!config) return {};

    const key = (linkKey || 'DEFAULT').toUpperCase();
    return {
      url: config.smsLinkUrls?.[key],
      message: config.smsLinkMessages?.[key],
    };
  }

  /**
   * Get Calendar ID by Assistant ID
   */
  static getCalendarId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.calendarId;
  }

  /**
   * Get Back-Neck Calendar ID by Assistant ID (program_tag routing)
   */
  static getBackNeckCalendarId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.backNeckCalendarId;
  }

  /**
   * Get Callback Calendar ID by Assistant ID
   */
  static getCallbackCalendarId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.callbackCalendarId;
  }

  /**
   * Get Gabriel Calendar ID by Assistant ID (DDP routing for <$40K collections)
   */
  static getGabrielCalendarId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.gabrielCalendarId;
  }

  /**
   * Get Guide Workflow ID by Assistant ID (send_text_guide — neuropathy/default)
   */
  static getGuideWorkflowId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.guideWorkflowId;
  }

  /**
   * Get Back-Neck Guide Workflow ID by Assistant ID (send_text_guide — back & neck)
   */
  static getBackNeckGuideWorkflowId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.backNeckGuideWorkflowId;
  }

  /**
   * Get Location ID by Assistant ID
   */
  static getLocationId(assistantId: string): string | undefined {
    const config = this.getConfigByAssistantId(assistantId);
    return config?.locationId;
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

