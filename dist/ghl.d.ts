import { SendSmsArgs, UpsertContactArgs, AddTagArgs, AddNoteArgs, UpdateStageArgs, CheckCalendarAvailabilityArgs, ScheduleAppointmentArgs, ToolResult } from './schemas.js';
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
     * Lookup a GHL contact by phone number.
     * Returns a ghlMetadata-shaped object or null if not found.
     */
    lookupContactByPhone(phone: string): Promise<{
        contactId: string;
        contact: any;
    } | null>;
    /**
     * Get the Calendar ID based on Assistant ID and optional calendar type.
     * - 'main' (default): primary client calendar
     * - 'gabriel': DDP secondary calendar (collections under $40K)
     * - 'callback': callback/recall calendar
     */
    private getCalendarId;
    sendSms(id: string, args: SendSmsArgs): Promise<ToolResult>;
    upsertContact(id: string, args: UpsertContactArgs): Promise<ToolResult>;
    addTag(id: string, args: AddTagArgs): Promise<ToolResult>;
    addNote(id: string, args: AddNoteArgs): Promise<ToolResult>;
    updateStage(id: string, args: UpdateStageArgs): Promise<ToolResult>;
    addNoteByContactIdViaAPI(id: string, contactId: string, note: string): Promise<ToolResult>;
    checkCalendarAvailability(id: string, args: CheckCalendarAvailabilityArgs, _callId?: string, _stateStorage?: any, calendarType?: 'main' | 'gabriel' | 'callback' | 'backneck'): Promise<ToolResult>;
    scheduleAppointment(id: string, args: ScheduleAppointmentArgs, ghlMetadata?: any, _callId?: string, _stateStorage?: any, calendarType?: 'main' | 'gabriel' | 'callback' | 'backneck'): Promise<ToolResult>;
}
