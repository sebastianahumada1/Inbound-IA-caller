import { z } from 'zod';
// Base webhook message schemas
// Schema para tool calls de Vapi (soporta formato con function anidado)
export const VapiToolCallSchema = z.object({
    id: z.string(),
    type: z.string().optional(), // "function"
    function: z.object({
        name: z.string(),
        arguments: z.any(), // Puede ser objeto o string JSON
    }).optional(),
    // Soporte para formato legacy (por si acaso)
    name: z.string().optional(),
    arguments: z.union([z.record(z.any()), z.string()]).optional(),
}).transform((data) => {
    // Si viene en el nuevo formato con function anidado
    if (data.function) {
        let parsedArgs = data.function.arguments;
        // Si arguments es un string JSON, parsearlo
        if (typeof parsedArgs === 'string') {
            try {
                parsedArgs = JSON.parse(parsedArgs);
            }
            catch {
                parsedArgs = {};
            }
        }
        return {
            id: data.id,
            name: data.function.name,
            arguments: parsedArgs || {},
        };
    }
    // Formato legacy - también puede tener arguments como string
    let parsedArgs = data.arguments;
    if (typeof parsedArgs === 'string') {
        try {
            parsedArgs = JSON.parse(parsedArgs);
        }
        catch {
            parsedArgs = {};
        }
    }
    return {
        id: data.id,
        name: data.name || '',
        arguments: parsedArgs || {},
    };
});
export const VapiToolCallsMessageSchema = z.object({
    type: z.literal('tool-calls'),
    toolCallList: z.array(VapiToolCallSchema),
    call: z.object({
        id: z.string().optional(),
        assistantId: z.string().optional(),
    }).optional(),
});
export const VapiCallEndedMessageSchema = z.object({
    type: z.literal('call.ended'),
    endedReason: z.string().optional(),
    call: z.object({
        id: z.string(),
    }).optional(),
});
export const VapiEndOfCallReportMessageSchema = z.object({
    type: z.literal('end-of-call-report'),
    timestamp: z.number().optional(),
    call: z.object({
        id: z.string(),
        assistantId: z.string().optional(), // VAPI Assistant ID
        recordingUrl: z.string().optional(), // URL of the call recording
    }).optional(),
    endedReason: z.string().optional(),
    duration: z.number().optional(),
    cost: z.number().optional(),
    analysis: z.object({
        summary: z.string().optional(),
        sentiment: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        actionItems: z.array(z.string()).optional(),
        // Add other analysis fields based on what Vapi provides
    }).optional(),
    recordingUrl: z.string().optional(), // Alternative location for recording URL
});
export const VapiTranscriptMessageSchema = z.object({
    type: z.literal('transcript'),
    transcript: z.string().optional(),
    call: z.object({
        id: z.string(),
    }).optional(),
    timestamp: z.number().optional(),
    role: z.enum(['user', 'assistant']).optional(),
    isFinal: z.boolean().optional(),
});
export const VapiStatusUpdateMessageSchema = z.object({
    type: z.literal('status-update'),
    status: z.string().optional(),
    call: z.object({
        id: z.string(),
    }).optional(),
    timestamp: z.number().optional(),
    details: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});
export const VapiMetadataMessageSchema = z.object({
    type: z.literal('metadata'),
    metadata: z.record(z.any()),
    call: z.object({
        id: z.string(),
    }).optional(),
    timestamp: z.number().optional(),
    source: z.string().optional(),
    category: z.string().optional(),
});
export const VapiGhlToolMessageSchema = z.object({
    type: z.literal('ghl_tool'),
    tool: z.object({
        name: z.string(),
        parameters: z.record(z.any()).optional(),
        action: z.string().optional(),
    }),
    call: z.object({
        id: z.string(),
    }).optional(),
    timestamp: z.number().optional(),
    metadata: z.record(z.any()).optional(),
});
export const VapiAssistantStartedMessageSchema = z.object({
    type: z.literal('assistant.started'),
    call: z.object({
        id: z.string(),
    }).passthrough().optional(),
    timestamp: z.number().optional(),
    newAssistant: z.record(z.any()).optional(),
    artifact: z.record(z.any()).optional(),
    phoneNumber: z.record(z.any()).optional(),
    customer: z.record(z.any()).optional(),
    assistant: z.record(z.any()).optional(),
}).passthrough();
export const VapiWebhookMessageSchema = z.discriminatedUnion('type', [
    VapiToolCallsMessageSchema,
    VapiCallEndedMessageSchema,
    VapiEndOfCallReportMessageSchema,
    VapiTranscriptMessageSchema,
    VapiStatusUpdateMessageSchema,
    VapiMetadataMessageSchema,
    VapiGhlToolMessageSchema,
    VapiAssistantStartedMessageSchema,
]);
export const VapiWebhookBodySchema = z.object({
    message: VapiWebhookMessageSchema,
});
// Tool argument schemas
export const SendSmsArgsSchema = z.object({
    phone: z.string().min(1),
    firstName: z.string().optional(),
    template: z.enum(['booking', 'deposit']).optional(),
    callId: z.string().optional(),
    body: z.string().min(1),
    apiKey: z.enum(['primary', 'secondary', 'third', 'fourth']).optional().default('primary'),
});
export const UpsertContactArgsSchema = z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    name: z.string().optional(),
    apiKey: z.enum(['primary', 'secondary', 'third', 'fourth']).optional().default('primary'),
}).refine(data => data.phone || data.email, {
    message: "Either phone or email must be provided"
});
export const AddTagArgsSchema = z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    tag: z.string().min(1),
    apiKey: z.enum(['primary', 'secondary', 'third', 'fourth']).optional().default('primary'),
}).refine(data => data.phone || data.email, {
    message: "Either phone or email must be provided"
});
export const AddNoteArgsSchema = z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    note: z.string().min(1),
    apiKey: z.enum(['primary', 'secondary', 'third', 'fourth']).optional().default('primary'),
}).refine(data => data.phone || data.email, {
    message: "Either phone or email must be provided"
});
export const UpdateStageArgsSchema = z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    pipelineId: z.string().min(1),
    stageId: z.string().min(1),
    note: z.string().optional(),
    apiKey: z.enum(['primary', 'secondary', 'third', 'fourth']).optional().default('primary'),
}).refine(data => data.phone || data.email, {
    message: "Either phone or email must be provided"
});
export const CheckCalendarAvailabilityArgsSchema = z.object({
    dateTime: z.string().min(1),
    durationMinutes: z.number().optional().default(30),
    // Program routing for multi-program frontdesk assistants (e.g. Miami Valley).
    // Absent for single-program clients (defaults to the main calendar).
    program_tag: z.enum(['NEUROPATHY', 'BACK_NECK']).optional(),
});
export const ScheduleAppointmentArgsSchema = z.object({
    contactId: z.string().optional(),
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    notes: z.string().optional().default(''),
    program_tag: z.enum(['NEUROPATHY', 'BACK_NECK']).optional(),
});
export const RescheduleAppointmentArgsSchema = z.object({
    // The contact is resolved (in priority order) from appointmentId's event,
    // contactId, webhook metadata, or a phone search. The AI usually only knows
    // the phone / contactId — it does not know the GHL event id.
    contactId: z.string().optional(),
    phone: z.string().optional(),
    // Optional: if the AI already has the GHL event id it can skip auto-lookup.
    appointmentId: z.string().optional(),
    newStartTime: z.string().min(1),
    newEndTime: z.string().min(1),
    notes: z.string().optional(),
    program_tag: z.enum(['NEUROPATHY', 'BACK_NECK']).optional(),
}).refine(data => data.contactId || data.phone || data.appointmentId, {
    message: "Either contactId, phone, or appointmentId must be provided",
});
export const LookupCallerArgsSchema = z.object({
    phone: z.string().min(1),
});
export const SearchContactArgsSchema = z.object({
    query: z.string().min(1),
});
export const DdpCheckContactArgsSchema = z.object({
    phone: z.string().min(1),
});
export const DdpCreateContactArgsSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().min(1),
    email: z.string().email().optional(),
});
// Generic (multi-client) contact tools
export const CheckContactArgsSchema = z.object({
    phone: z.string().optional(),
    query: z.string().optional(),
});
export const CreateContactArgsSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().min(1),
    email: z.string().email().optional(),
});
export const DdpMarkTransferredArgsSchema = z.object({
    contactId: z.string().optional(),
});
export const DdpMarkTransferredSupportArgsSchema = z.object({
    contactId: z.string().optional(),
});
export const SendTextGuideArgsSchema = z.object({
    contactId: z.string().optional(),
    guide_type: z.string().optional(), // informational; program is resolved by assistant
});
// Response schemas
export const ToolResultSchema = z.object({
    id: z.string(),
    ok: z.boolean(),
    data: z.any().optional(),
    error: z.string().optional(),
});
export const WebhookResponseSchema = z.object({
    ok: z.boolean(),
    results: z.array(ToolResultSchema).optional(),
    message: z.string().optional(),
});
