import { SendSmsArgs, UpsertContactArgs, AddTagArgs, AddNoteArgs, UpdateStageArgs, CheckCalendarAvailabilityArgs, ScheduleAppointmentArgs, CheckCallbackAvailabilityArgs, ScheduleCallbackArgs, ToolResult } from './schemas.js';
export declare class GHLConnector {
    private httpClient;
    private readonly defaultWebhookUrl;
    private readonly bookingWebhookUrl;
    private readonly depositWebhookUrl;
    private assistantId;
    constructor(assistantId?: string);
    /**
     * Set the Assistant ID for this connector instance
     */
    setAssistantId(assistantId: string): void;
    /**
     * Get the appropriate GHL API Key based on Assistant ID
     */
    private getGHLApiKey;
    /**
     * Get the Calendar ID based on Assistant ID
     */
    private getCalendarId;
    /**
     * Get the Callback Calendar ID based on Assistant ID
     */
    private getCallbackCalendarId;
    /**
     * Extract time mentioned by user from transcript
     * Looks for patterns like "9 AM", "3 PM", "2:30 PM", etc.
     */
    private extractTimeFromTranscript;
    /**
     * Validate and correct appointment time using transcript if available
     * Ensures the time matches what the user actually said
     */
    private correctAppointmentTimeWithTranscript;
    /**
     * Validate and correct appointment time to ensure it matches user's requested time
     * Detects common AI timezone conversion errors and corrects them
     * Business hours: 8 AM - 7 PM (08:00 - 19:00)
     */
    private correctAppointmentTime;
    sendSms(id: string, args: SendSmsArgs): Promise<ToolResult>;
    upsertContact(id: string, args: UpsertContactArgs): Promise<ToolResult>;
    addTag(id: string, args: AddTagArgs): Promise<ToolResult>;
    addNote(id: string, args: AddNoteArgs): Promise<ToolResult>;
    updateStage(id: string, args: UpdateStageArgs): Promise<ToolResult>;
    addNoteByContactIdViaAPI(id: string, contactId: string, note: string): Promise<ToolResult>;
    checkCalendarAvailability(id: string, args: CheckCalendarAvailabilityArgs, callId?: string, stateStorage?: any): Promise<ToolResult>;
    checkCallbackAvailability(id: string, args: CheckCallbackAvailabilityArgs, callId?: string, stateStorage?: any): Promise<ToolResult>;
    /**
     * Shared logic for checking calendar availability (appointment or callback)
     */
    private checkAvailabilityInternal;
    scheduleAppointment(id: string, args: ScheduleAppointmentArgs, ghlMetadata?: any, callId?: string, stateStorage?: any): Promise<ToolResult>;
    scheduleCallback(id: string, args: ScheduleCallbackArgs, ghlMetadata?: any, callId?: string, stateStorage?: any): Promise<ToolResult>;
    /**
     * Shared logic for scheduling events in GHL (appointment or callback)
     */
    private scheduleEventInternal;
}
