import { z } from 'zod';
// Base webhook message schemas
export const VapiToolCallSchema = z.object({
    id: z.string(),
    name: z.string(),
    arguments: z.record(z.any()),
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
export const VapiWebhookMessageSchema = z.discriminatedUnion('type', [
    VapiToolCallsMessageSchema,
    VapiCallEndedMessageSchema,
    VapiEndOfCallReportMessageSchema,
    VapiTranscriptMessageSchema,
    VapiStatusUpdateMessageSchema,
    VapiMetadataMessageSchema,
    VapiGhlToolMessageSchema,
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
});
export const ScheduleAppointmentArgsSchema = z.object({
    contactId: z.string().min(1),
    name: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    notes: z.string().optional().default(''),
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
