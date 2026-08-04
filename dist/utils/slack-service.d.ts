export interface SlackMessageOptions {
    channelId: string;
    text: string;
    threadTs?: string;
}
export declare class SlackService {
    private botToken;
    private defaultChannelId;
    constructor();
    /**
     * Sends a text message to a Slack channel
     */
    sendMessage(options: SlackMessageOptions): Promise<any>;
    /**
     * Sends recording link with context message (no file upload)
     */
    uploadRecordingWithContext(recordingUrl: string | null, callId: string, assistantId?: string, ghlMetadata?: any, fullCallData?: any, context?: {
        duration?: number;
        cost?: number;
        summary?: string;
        sentiment?: string;
    }): Promise<void>;
    /**
     * Test the Slack connection
     */
    testConnection(): Promise<boolean>;
}
