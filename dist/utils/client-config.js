// Load environment variables FIRST (this module is imported early in the chain)
import dotenv from 'dotenv';
dotenv.config();
import { Logger } from './logger.js';
/**
 * Client Configuration Manager
 * Maps VAPI Assistant IDs to their respective GHL API keys and configurations
 */
export class ClientConfigManager {
    static configs = new Map();
    /**
     * Initialize client configurations from environment variables
     */
    static initialize() {
        // Define all clients with their environment variable names
        const clientDefinitions = [
            {
                name: 'Premier Wellness',
                assistantIdVar: 'PREMIER_WELLNESS_ASSISTANT_ID',
                apiKeyVar: 'PREMIER_WELLNESS_GHL_API_KEY',
                calendarIdVar: 'PREMIER_WELLNESS_CALENDAR_ID',
                slackChannelVar: 'SLACK_CHANNEL_ID_PREMIER_WELLNESS',
            },
            {
                name: 'West Texas',
                assistantIdVar: 'WEST_TEXAS_ASSISTANT_ID',
                apiKeyVar: 'WEST_TEXAS_GHL_API_KEY',
                calendarIdVar: 'WEST_TEXAS_CALENDAR_ID',
                slackChannelVar: 'SLACK_CHANNEL_ID_WEST_TEXAS',
            },
            {
                name: 'Third Client',
                assistantIdVar: 'THIRD_CLIENT_ASSISTANT_ID',
                apiKeyVar: 'THIRD_CLIENT_GHL_API_KEY',
                calendarIdVar: 'THIRD_CLIENT_CALENDAR_ID',
                slackChannelVar: 'SLACK_CHANNEL_ID_THIRD_CLIENT',
            },
            {
                name: 'Data Driven Practices',
                assistantIdVar: 'DATA_DRIVEN_PRACTICES_ASSISTANT_ID',
                apiKeyVar: 'DATA_DRIVEN_PRACTICES_GHL_API_KEY',
                calendarIdVar: 'DATA_DRIVEN_PRACTICES_CALENDAR_ID',
                slackChannelVar: 'SLACK_CHANNEL_ID_DATA_DRIVEN_PRACTICES',
            },
            {
                name: 'NuVive',
                assistantIdVar: 'NUVIVE_ASSISTANT_ID',
                apiKeyVar: 'NUVIVE_GHL_API_KEY',
                calendarIdVar: 'NUVIVE_CALENDAR_ID',
                slackChannelVar: 'SLACK_CHANNEL_ID_NUVIVE',
            },
        ];
        const missingConfigs = [];
        const configuredClients = [];
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
            const config = {
                name: clientDef.name,
                assistantId,
                ghlApiKey: apiKey,
            };
            // Add optional calendar ID if configured
            const calendarId = process.env[clientDef.calendarIdVar];
            if (calendarId) {
                config.calendarId = calendarId;
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
        // Log initialization summary
        if (this.configs.size === 0) {
            Logger.error('[CLIENT_CONFIG] No client configurations loaded! Check environment variables.', {
                missingConfigs,
            });
        }
        else {
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
    static getConfigByAssistantId(assistantId) {
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
    static getGHLApiKey(assistantId) {
        const config = this.getConfigByAssistantId(assistantId);
        return config?.ghlApiKey || null;
    }
    /**
     * Get client name by Assistant ID
     */
    static getClientName(assistantId) {
        const config = this.getConfigByAssistantId(assistantId);
        return config?.name || 'Unknown Client';
    }
    /**
     * Get Calendar ID by Assistant ID
     */
    static getCalendarId(assistantId) {
        const config = this.getConfigByAssistantId(assistantId);
        return config?.calendarId;
    }
    /**
     * Get Slack Channel ID by Assistant ID
     */
    static getSlackChannelId(assistantId) {
        const config = this.getConfigByAssistantId(assistantId);
        return config?.slackChannelId;
    }
    /**
     * Get all configured clients
     */
    static getAllClients() {
        return Array.from(this.configs.values());
    }
    /**
     * Check if Assistant ID is configured
     */
    static isConfigured(assistantId) {
        return this.configs.has(assistantId);
    }
}
// Initialize configurations on module load
ClientConfigManager.initialize();
