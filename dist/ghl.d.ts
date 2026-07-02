import { SendSmsArgs, UpsertContactArgs, AddTagArgs, AddNoteArgs, UpdateStageArgs, CheckCalendarAvailabilityArgs, ScheduleAppointmentArgs, RescheduleAppointmentArgs, ToolResult } from './schemas.js';
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
    /**
     * Reconcile an AI-provided ISO start time against GHL's canonical free slots.
     *
     * The LLM frequently re-emits a slot we returned (e.g. in "-06:00") using the
     * caller's local offset (e.g. "-04:00") — a different UTC instant but the same
     * wall clock. GHL then rejects it as "no longer available". We recover the
     * canonical ISO by matching on the local wall-clock (YYYY-MM-DDTHH:MM). Falls
     * back to the AI value (with an EST offset if none is present) when no match.
     */
    private reconcileSlot;
    /**
     * Reschedule an existing, active appointment to a new time slot.
     *
     * Flow: resolve the contact (from args / metadata / phone search) → find the
     * contact's next active appointment on the target calendar (unless the AI
     * passed an explicit appointmentId) → reconcile the new slot against GHL's
     * free-slots → PUT the event in place so the same appointmentId and history
     * are preserved.
     */
    rescheduleAppointment(id: string, args: RescheduleAppointmentArgs, ghlMetadata?: any, _callId?: string, _stateStorage?: any, calendarType?: 'main' | 'gabriel' | 'callback' | 'backneck'): Promise<ToolResult>;
}
