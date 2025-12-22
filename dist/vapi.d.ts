import { Request, Response } from 'express';
export declare class VapiWebhookHandler {
    private ghlConnector;
    private vapiApiClient;
    private slackService;
    private stateStorage;
    constructor();
    validateToken(req: Request, res: Response, next: () => void): void;
    handleWebhook(req: Request, res: Response): Promise<void>;
    private processMessage;
    private handleToolCalls;
    private dispatchToolCall;
    private handleSendSms;
    private handleUpsertContact;
    private handleAddTag;
    private handleAddNote;
    private handleUpdateStage;
    private handleCheckCalendarAvailability;
    private handleScheduleAppointment;
    private handleCallEnded;
    private handleEndOfCallReport;
    private processEndOfCallReport;
    private handleTranscript;
    private handleStatusUpdate;
    private handleMetadata;
    private handleGhlTool;
    private dispatchGhlTool;
    private handleCreateOpportunity;
    private handleUpdateContact;
    private handleSendEmail;
    pullCallMetadata(callId: string): Promise<any>;
    pullAndProcessGhlMetadata(callId: string): Promise<any>;
    private processGhlMetadata;
    scheduleMetadataPull(callId: string, delays?: number[]): Promise<void>;
    private sendFinalSummaryNote;
    /**
     * Uploads a recording to Slack with context information
     */
    private uploadRecordingToSlack;
    /**
     * Test Slack connection
     */
    testSlackConnection(): Promise<boolean>;
    /**
     * Get storage status for health checks
     */
    getStorageStatus(): {
        type: string;
        available: boolean;
        ttl: number;
    };
}
