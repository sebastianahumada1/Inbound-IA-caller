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
    smsLinkUrls?: Record<string, string>;
    smsLinkMessages?: Record<string, string>;
}
/**
 * Client Configuration Manager
 * Maps VAPI Assistant IDs to their respective GHL API keys and configurations
 */
export declare class ClientConfigManager {
    private static configs;
    /**
     * Initialize client configurations from environment variables
     */
    static initialize(): void;
    /**
     * Get client configuration by Assistant ID
     */
    static getConfigByAssistantId(assistantId: string): ClientConfig | null;
    /**
     * Get GHL API Key by Assistant ID
     */
    static getGHLApiKey(assistantId: string): string | null;
    /**
     * Get client name by Assistant ID
     */
    static getClientName(assistantId: string): string;
    /**
     * Get the send_text_link URL and lead-in message for a client.
     * Omit linkKey for the client's default link.
     */
    static getSmsLink(assistantId: string, linkKey?: string): {
        url?: string | undefined;
        message?: string | undefined;
    };
    /**
     * Get Calendar ID by Assistant ID
     */
    static getCalendarId(assistantId: string): string | undefined;
    /**
     * Get Back-Neck Calendar ID by Assistant ID (program_tag routing)
     */
    static getBackNeckCalendarId(assistantId: string): string | undefined;
    /**
     * Get Callback Calendar ID by Assistant ID
     */
    static getCallbackCalendarId(assistantId: string): string | undefined;
    /**
     * Get Gabriel Calendar ID by Assistant ID (DDP routing for <$40K collections)
     */
    static getGabrielCalendarId(assistantId: string): string | undefined;
    /**
     * Get Guide Workflow ID by Assistant ID (send_text_guide — neuropathy/default)
     */
    static getGuideWorkflowId(assistantId: string): string | undefined;
    /**
     * Get Back-Neck Guide Workflow ID by Assistant ID (send_text_guide — back & neck)
     */
    static getBackNeckGuideWorkflowId(assistantId: string): string | undefined;
    /**
     * Get Location ID by Assistant ID
     */
    static getLocationId(assistantId: string): string | undefined;
    /**
     * Get Slack Channel ID by Assistant ID
     */
    static getSlackChannelId(assistantId: string): string | undefined;
    /**
     * Get all configured clients
     */
    static getAllClients(): ClientConfig[];
    /**
     * Check if Assistant ID is configured
     */
    static isConfigured(assistantId: string): boolean;
}
