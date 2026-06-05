import { ZodError } from 'zod';
import { GHLConnector } from './ghl.js';
import { Logger } from './utils/logger.js';
import { VapiApiClient } from './utils/vapi-client.js';
import { SlackService } from './utils/slack-service.js';
import { StateStorage } from './utils/state-storage.js';
import { ClientConfigManager } from './utils/client-config.js';
import { VapiWebhookBodySchema, SendSmsArgsSchema, UpsertContactArgsSchema, AddTagArgsSchema, AddNoteArgsSchema, UpdateStageArgsSchema, CheckCalendarAvailabilityArgsSchema, ScheduleAppointmentArgsSchema, LookupCallerArgsSchema, SearchContactArgsSchema, DdpCheckContactArgsSchema, DdpCreateContactArgsSchema, DdpMarkTransferredArgsSchema, DdpMarkTransferredSupportArgsSchema, SendTextGuideArgsSchema, CheckContactArgsSchema, CreateContactArgsSchema, } from './schemas.js';
import { hotProspectorSearchByPhone } from './lib/hotProspector.js';
export class VapiWebhookHandler {
    ghlConnector;
    vapiApiClient;
    slackService;
    stateStorage; // ✅ Persistent storage for Vercel
    constructor() {
        this.ghlConnector = new GHLConnector();
        this.vapiApiClient = new VapiApiClient();
        this.stateStorage = new StateStorage(); // ✅ Initialize StateStorage
        // Initialize Slack service if credentials are available
        try {
            this.slackService = new SlackService();
            Logger.info('[VAPI_HANDLER] Slack integration enabled');
        }
        catch (error) {
            this.slackService = null;
            Logger.warn('[VAPI_HANDLER] Slack integration disabled - missing credentials', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    // Token validation middleware
    validateToken(req, res, next) {
        const token = req.query.token;
        const expectedToken = process.env.WEBHOOK_TOKEN;
        if (!expectedToken) {
            Logger.error('WEBHOOK_TOKEN environment variable not set');
            res.status(500).json({ ok: false, message: 'Server configuration error' });
            return;
        }
        if (!token || token !== expectedToken) {
            Logger.warn('Invalid webhook token', {
                provided: token ? 'provided' : 'missing',
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            res.status(401).json({ ok: false, message: 'Unauthorized' });
            return;
        }
        next();
    }
    // Main webhook handler
    async handleWebhook(req, res) {
        try {
            Logger.info('Received Vapi webhook', {
                method: req.method,
                url: req.url,
                contentType: req.get('Content-Type'),
                userAgent: req.get('User-Agent'),
            });
            // Validate request body
            const validationResult = VapiWebhookBodySchema.safeParse(req.body);
            if (!validationResult.success) {
                Logger.error('Invalid webhook body', {
                    errors: validationResult.error.issues,
                    body: req.body
                });
                // Si es un tool-calls, devolver 200 con error en el resultado (formato Vapi)
                const messageType = req.body?.message?.type;
                if (messageType === 'tool-calls') {
                    const toolCalls = req.body?.message?.toolCallList || [];
                    const errorMessage = `Invalid request: ${validationResult.error.issues.map((i) => i.message).join(', ')}`;
                    const errorResults = toolCalls.map((tc) => ({
                        toolCallId: tc.id || tc.function?.name || 'unknown',
                        result: errorMessage,
                    }));
                    res.status(200).json({
                        results: errorResults,
                    });
                    return;
                }
                // Para otros tipos, devolver 400
                res.status(400).json({
                    ok: false,
                    message: 'Invalid request body',
                    errors: validationResult.error.issues,
                });
                return;
            }
            const webhookBody = validationResult.data;
            Logger.debug('Parsed webhook body', { message: webhookBody.message });
            const response = await this.processMessage(webhookBody);
            Logger.info('Webhook processed successfully', {
                messageType: webhookBody.message.type,
                ok: response.ok
            });
            res.status(200).json(response);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error processing webhook', { error: errorMessage });
            // Si es tool-calls, devolver 200 con error (formato Vapi)
            const messageType = req.body?.message?.type;
            if (messageType === 'tool-calls') {
                const toolCalls = req.body?.message?.toolCallList || [];
                const errorResults = toolCalls.map((tc) => ({
                    toolCallId: tc.id || tc.function?.name || 'unknown',
                    result: errorMessage,
                }));
                res.status(200).json({
                    results: errorResults,
                });
                return;
            }
            res.status(500).json({
                ok: false,
                message: 'Internal server error',
            });
        }
    }
    async processMessage(webhookBody) {
        const { message } = webhookBody;
        const assistantId = message.call?.assistantId;
        // Log assistant ID if available
        if (assistantId) {
            Logger.info('[WEBHOOK] Processing message for assistant', {
                type: message.type,
                assistantId,
            });
        }
        switch (message.type) {
            case 'tool-calls':
                // Extract GHL metadata from call metadata if available
                // GHL sends metadata.ghl.contactId when it triggers Vapi
                const ghlMetadata = message.call?.metadata?.ghl || null;
                const callId = message.call?.id;
                const customerPhone = message.call?.customer?.number || null;
                Logger.info('[VAPI] Extracted GHL metadata for tool-calls', {
                    callId,
                    hasGhlMetadata: !!ghlMetadata,
                    ghlMetadataKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
                    contactId: ghlMetadata?.contactId,
                    hasContact: !!ghlMetadata?.contact,
                    contactKeys: ghlMetadata?.contact ? Object.keys(ghlMetadata.contact) : [],
                    contactPhone: ghlMetadata?.contact?.phone,
                    contactPhoneNumber: ghlMetadata?.contact?.phoneNumber,
                    fullGhlMetadata: JSON.stringify(ghlMetadata).substring(0, 500),
                });
                return await this.handleToolCalls(message.toolCallList, assistantId, ghlMetadata, callId, customerPhone);
            case 'call.ended':
                return this.handleCallEnded(message);
            case 'end-of-call-report':
                return await this.handleEndOfCallReport(message);
            case 'transcript':
                return await this.handleTranscript(message);
            case 'status-update':
                return this.handleStatusUpdate(message);
            case 'metadata':
                return this.handleMetadata(message);
            case 'ghl_tool':
                return await this.handleGhlTool(message);
            case 'assistant.started':
                Logger.info('[WEBHOOK] Assistant started', {
                    callId: message.call?.id,
                    assistantName: message.newAssistant?.name || message.assistant?.name,
                });
                return {
                    ok: true,
                    message: 'Assistant started acknowledged',
                };
            default:
                Logger.warn('Unknown message type', { type: message.type });
                return {
                    ok: true,
                    message: 'Message type not handled',
                };
        }
    }
    async handleToolCalls(toolCallList, assistantId, ghlMetadata, callId, customerPhone) {
        Logger.info('Processing tool calls', {
            count: toolCallList.length,
            assistantId,
            callId,
            hasGhlMetadata: !!ghlMetadata,
        });
        // Set assistant ID in GHL connector if available
        if (assistantId) {
            this.ghlConnector.setAssistantId(assistantId);
        }
        const vapiResults = [];
        // Process tool calls sequentially to avoid overwhelming GHL
        for (const toolCall of toolCallList) {
            const result = await this.dispatchToolCall(toolCall, ghlMetadata, callId, assistantId, customerPhone);
            // Convert to Vapi format: toolCallId and result (as string)
            let resultString;
            if (result.ok) {
                // Convert data to JSON string if it exists, otherwise use success message
                if (result.data) {
                    resultString = JSON.stringify(result.data);
                }
                else {
                    resultString = 'Success';
                }
            }
            else {
                // For errors, return error message as string
                resultString = result.error || 'Unknown error';
            }
            vapiResults.push({
                toolCallId: result.id,
                result: resultString,
            });
        }
        // Vapi expects just the results array, not wrapped in ok/message
        return {
            results: vapiResults,
        };
    }
    async dispatchToolCall(toolCall, ghlMetadata, callId, assistantId, customerPhone) {
        const { id, name, arguments: args } = toolCall;
        Logger.info('Dispatching tool call', { id, name, callId, args, hasGhlMetadata: !!ghlMetadata });
        try {
            switch (name) {
                case 'send_sms':
                    return await this.handleSendSms(id, args);
                case 'upsert_contact':
                    return await this.handleUpsertContact(id, args);
                case 'add_tag':
                    return await this.handleAddTag(id, args);
                case 'add_note':
                    return await this.handleAddNote(id, args);
                case 'update_stage':
                    return await this.handleUpdateStage(id, args);
                case 'check_calendar_availability':
                case 'check_calendar_availability_inbound':
                case 'check_ddp_availability_inbound':
                    return await this.handleCheckCalendarAvailability(id, args, callId);
                case 'check_gabriel_availability_inbound':
                    return await this.handleCheckCalendarAvailability(id, args, callId, 'gabriel');
                case 'check_callback_availability_inbound':
                    return await this.handleCheckCalendarAvailability(id, args, callId, 'callback');
                case 'schedule_appointment':
                case 'schedule_appointment_inbound':
                case 'schedule_ddp_inbound':
                    return await this.handleScheduleAppointment(id, args, ghlMetadata, callId);
                case 'schedule_gabriel':
                case 'schedule_gabriel_inbound':
                    return await this.handleScheduleAppointment(id, args, ghlMetadata, callId, 'gabriel');
                case 'schedule_callback_inbound':
                    return await this.handleScheduleAppointment(id, args, ghlMetadata, callId, 'callback');
                case 'lookup_caller':
                    return await this.handleLookupCaller(id, args, callId, customerPhone);
                case 'search_contact':
                case 'premier_inbound_contactid':
                case 'inbound_contactid':
                    return await this.handleSearchContact(id, args, callId, assistantId);
                case 'ddp_check_contact':
                    return await this.handleDdpCheckContact(id, args, callId, assistantId, customerPhone);
                case 'ddp_create_contact':
                    return await this.handleDdpCreateContact(id, args, callId, assistantId);
                case 'check_contact':
                    return await this.handleCheckContact(id, args, callId, assistantId, customerPhone);
                case 'create_contact':
                    return await this.handleCreateContact(id, args, callId, assistantId);
                case 'ddp_mark_transferred':
                    return await this.handleDdpMarkTransferred(id, args, callId, assistantId);
                case 'ddp_mark_transferred_support':
                    return await this.handleDdpMarkTransferredSupport(id, args, callId, assistantId);
                case 'send_text_guide':
                    return await this.handleSendTextGuide(id, args, callId, assistantId);
                default:
                    Logger.warn('Unknown tool name', { id, name });
                    return {
                        id,
                        ok: false,
                        error: `Unknown tool: ${name}`,
                    };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error dispatching tool call', { id, name, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async handleSendSms(id, args) {
        try {
            const validatedArgs = SendSmsArgsSchema.parse(args);
            return await this.ghlConnector.sendSms(id, validatedArgs);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid send_sms arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleUpsertContact(id, args) {
        try {
            const validatedArgs = UpsertContactArgsSchema.parse(args);
            return await this.ghlConnector.upsertContact(id, validatedArgs);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid upsert_contact arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleAddTag(id, args) {
        try {
            const validatedArgs = AddTagArgsSchema.parse(args);
            return await this.ghlConnector.addTag(id, validatedArgs);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid add_tag arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleAddNote(id, args) {
        try {
            const validatedArgs = AddNoteArgsSchema.parse(args);
            return await this.ghlConnector.addNote(id, validatedArgs);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid add_note arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleUpdateStage(id, args) {
        try {
            const validatedArgs = UpdateStageArgsSchema.parse(args);
            return await this.ghlConnector.updateStage(id, validatedArgs);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid update_stage arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleCheckCalendarAvailability(id, args, callId, calendarType = 'main') {
        try {
            const validatedArgs = CheckCalendarAvailabilityArgsSchema.parse(args);
            // For multi-program frontdesk assistants, program_tag routes the default
            // ("main") calendar to the back-neck calendar. Gabriel/callback flows are
            // unaffected, and single-program clients never send program_tag.
            const effectiveType = calendarType === 'main' && validatedArgs.program_tag === 'BACK_NECK' ? 'backneck' : calendarType;
            const result = await this.ghlConnector.checkCalendarAvailability(id, validatedArgs, callId, this.stateStorage, effectiveType);
            if (callId && result.ok) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    lastCheckedCalendarType: effectiveType,
                });
            }
            return result;
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid check_calendar_availability arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    async handleScheduleAppointment(id, args, ghlMetadata, callId, calendarType = 'main') {
        try {
            const validatedArgs = ScheduleAppointmentArgsSchema.parse(args);
            // Mirror the program_tag routing applied in handleCheckCalendarAvailability
            // so the mismatch guard and the booking target the same calendar.
            const effectiveType = calendarType === 'main' && validatedArgs.program_tag === 'BACK_NECK' ? 'backneck' : calendarType;
            if (callId) {
                const metadata = await this.stateStorage.getCallMetadata(callId);
                const lastChecked = metadata?.lastCheckedCalendarType;
                if (lastChecked && lastChecked !== effectiveType) {
                    const expectedCheckTool = effectiveType === 'gabriel' ? 'check_gabriel_availability_inbound' :
                        effectiveType === 'callback' ? 'check_callback_availability_inbound' :
                            effectiveType === 'backneck' ? 'check_calendar_availability (program_tag: BACK_NECK)' :
                                'check_ddp_availability_inbound';
                    Logger.warn('[SCHEDULE] Calendar mismatch — refusing booking', { callId, lastChecked, attempted: effectiveType });
                    return {
                        id,
                        ok: false,
                        error: `Calendar mismatch: availability was last checked on the "${lastChecked}" calendar but you are trying to book on the "${effectiveType}" calendar. Call ${expectedCheckTool} first to confirm the slot is open on the correct calendar, then retry this booking.`,
                    };
                }
            }
            return await this.ghlConnector.scheduleAppointment(id, validatedArgs, ghlMetadata, callId, this.stateStorage, effectiveType);
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('Invalid schedule_appointment arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            throw error;
        }
    }
    // ── HotProspector Lookup Tool ──────────────────────────────────────
    async handleLookupCaller(id, args, callId, customerPhone) {
        try {
            const validatedArgs = LookupCallerArgsSchema.parse(args);
            // Always prefer the real caller phone from VAPI call data.
            // The AI frequently sends incomplete numbers (e.g. "+1") because it
            // doesn't know the caller's full number — the server does.
            let phone = customerPhone || validatedArgs.phone;
            if (!phone) {
                Logger.warn('[LOOKUP_CALLER] No phone number available', { callId });
                return {
                    id,
                    ok: true,
                    data: { found: false, callerType: 'unknown', message: 'No phone number available for lookup.' },
                };
            }
            Logger.info('[LOOKUP_CALLER] Looking up caller in HotProspector', {
                toolCallId: id,
                callId,
                phone,
                aiPhone: validatedArgs.phone,
                usedRealCallerPhone: !!customerPhone,
            });
            const hpResult = await hotProspectorSearchByPhone(phone);
            if (!hpResult.ok || hpResult.count === 0 || !hpResult.lead) {
                Logger.info('[LOOKUP_CALLER] No lead found', { callId, phone });
                return {
                    id,
                    ok: true,
                    data: {
                        found: false,
                        callerType: 'unknown',
                        phone,
                        message: 'No record found for this phone number.',
                    },
                };
            }
            const lead = hpResult.lead;
            const fullName = `${lead.Firstname ?? ''} ${lead.Lastname ?? ''}`.trim();
            const mobile = lead.Mobile ?? lead.Phone ?? '';
            const cc = lead.CountryCode ?? '+1';
            const fullPhone = mobile.startsWith('+') ? mobile : `${cc}${mobile}`;
            const cf = lead.Lead_Custom_Fields;
            // Validate that the HP result actually belongs to the caller.
            // HP's SearchByUserInput can return arbitrary results when no exact
            // match exists. Compare trailing digits (last 10) to catch both US
            // and international formats.
            const callerDigits = phone.replace(/\D/g, '');
            const leadDigits = mobile.replace(/\D/g, '');
            if (callerDigits && leadDigits) {
                const compareLen = Math.min(callerDigits.length, leadDigits.length, 10);
                const callerSuffix = callerDigits.slice(-compareLen);
                const leadSuffix = leadDigits.slice(-compareLen);
                if (callerSuffix !== leadSuffix) {
                    Logger.warn('[LOOKUP_CALLER] HP result phone does not match caller — discarding', {
                        callId,
                        callerPhone: phone,
                        leadPhone: mobile,
                        leadName: fullName,
                    });
                    return {
                        id,
                        ok: true,
                        data: {
                            found: false,
                            callerType: 'unknown',
                            phone,
                            message: 'No record found for this phone number.',
                        },
                    };
                }
            }
            // Build a flat data object the agent can consume directly
            const leadData = {
                found: true,
                callerType: 'known',
                // Core contact info
                leadId: lead.LeadId ?? '',
                firstName: lead.Firstname ?? '',
                lastName: lead.Lastname ?? '',
                fullName,
                email: lead['E-Mail'] ?? '',
                phone: fullPhone,
                mobile: lead.Mobile ?? '',
                countryCode: lead.CountryCode ?? '',
                // Location / Group
                locationId: lead.LocationId ?? '',
                groupId: lead.GroupId ?? '',
                tags: lead.Tags ?? '',
                // Address
                city: lead.City ?? '',
                state: lead.State ?? '',
                zipcode: lead.Zipcode ?? '',
                address: lead.Address ?? '',
                company: lead.Company ?? '',
            };
            // Custom fields (appointment, medical, etc.)
            if (cf) {
                leadData.appointmentDate = cf.appointment_date ?? '';
                leadData.appointmentTime = cf.appointment_time ?? '';
                leadData.callCount = cf.call_count ?? '';
                leadData.painLocation = this.stringifyField(cf.where_is_your_pain_located);
                leadData.hasMri = cf.have_you_had_an_mri ?? '';
                leadData.reasonableCommute =
                    cf.is__custom_valuescity__a_reasonable_commute_for_you ?? '';
                leadData.doctorVisit = this.stringifyField(cf.have_you_seen_a_doctor_for_your_pain_if_so_what_did_they_tell_you_);
                leadData.triedTreatments = this.stringifyField(cf.have_you_tried_procedures_or_treatments_for_your_pain);
                leadData.symptoms = this.stringifyField(cf.describe_your_symptoms_check_all_that_apply);
                leadData.takingMedications =
                    cf.are_you_currently_taking_medications_for_your_pain ?? '';
                leadData.painDuration =
                    cf.how_long_have_you_been_suffering_from_back_pain_disc_pain_or_sciatica ?? '';
                leadData.sopLink = cf.back__neck_sop_link ?? '';
            }
            Logger.info('[LOOKUP_CALLER] Lead found, returning data to agent', {
                callId,
                leadId: lead.LeadId,
                firstName: lead.Firstname,
                fieldCount: Object.keys(leadData).length,
            });
            // Persist lead info so end-of-call-report can use it for Slack notification
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    firstName: lead.Firstname ?? '',
                    lastName: lead.Lastname ?? '',
                    email: lead['E-Mail'] ?? '',
                    phone: fullPhone,
                    locationId: lead.LocationId ?? '',
                });
            }
            return {
                id,
                ok: true,
                data: leadData,
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('[LOOKUP_CALLER] Invalid arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[LOOKUP_CALLER] Error during lookup', { id, callId, error: errorMessage });
            return {
                id,
                ok: false,
                error: `Lookup failed: ${errorMessage}`,
            };
        }
    }
    // ── GHL Contact Search Tool ─────────────────────────────────────────
    async handleSearchContact(id, args, callId, assistantId) {
        try {
            const validatedArgs = SearchContactArgsSchema.parse(args);
            const { query } = validatedArgs;
            Logger.info('[SEARCH_CONTACT] Searching contact in GHL', {
                toolCallId: id,
                callId,
                assistantId,
                query,
            });
            // Resolve credentials: client-specific first, then env fallback
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId))
                || process.env.GHL_API_KEY;
            const locationId = (assistantId && ClientConfigManager.getLocationId(assistantId))
                || process.env.GHL_LOCATION_ID;
            Logger.info('[SEARCH_CONTACT] Resolved credentials', {
                callId,
                source: assistantId && ClientConfigManager.isConfigured(assistantId) ? 'client-config' : 'env',
                hasApiKey: !!apiKey,
                hasLocationId: !!locationId,
            });
            if (!apiKey) {
                Logger.error('[SEARCH_CONTACT] No GHL API key available');
                return { id, ok: false, error: 'GHL API key not configured' };
            }
            if (!locationId) {
                Logger.error('[SEARCH_CONTACT] No GHL Location ID available');
                return { id, ok: false, error: 'GHL Location ID not configured' };
            }
            const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(query)}`;
            const resp = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                },
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[SEARCH_CONTACT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            const contact = data.contacts?.[0];
            if (!contact) {
                Logger.info('[SEARCH_CONTACT] No contact found', { callId, query });
                return {
                    id,
                    ok: true,
                    data: {
                        found: false,
                        query,
                        message: `No contact found for: ${query}`,
                    },
                };
            }
            Logger.info('[SEARCH_CONTACT] Contact found', {
                callId,
                contactId: contact.id,
                name: contact.firstName,
            });
            // Persist contactId so end-of-call-report can build the GHL link
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    contactId: contact.id,
                    firstName: existing.firstName || contact.firstName || '',
                    lastName: existing.lastName || contact.lastName || '',
                    email: existing.email || contact.email || '',
                    phone: existing.phone || contact.phone || '',
                });
            }
            return {
                id,
                ok: true,
                data: {
                    found: true,
                    contactId: contact.id,
                    firstName: contact.firstName ?? '',
                    lastName: contact.lastName ?? '',
                    name: `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim(),
                    email: contact.email ?? '',
                    phone: contact.phone ?? '',
                },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                Logger.error('[SEARCH_CONTACT] Invalid arguments', { id, errors: error.issues });
                return {
                    id,
                    ok: false,
                    error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}`,
                };
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[SEARCH_CONTACT] Error during search', { id, callId, error: errorMessage });
            return { id, ok: false, error: `Search failed: ${errorMessage}` };
        }
    }
    // ── DDP: Check if contact exists ───────────────────────────────────
    async handleDdpCheckContact(id, args, callId, assistantId, customerPhone) {
        try {
            const validatedArgs = DdpCheckContactArgsSchema.parse(args);
            const phone = customerPhone || validatedArgs.phone;
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            const locationId = (assistantId && ClientConfigManager.getLocationId(assistantId)) || process.env.GHL_LOCATION_ID;
            if (!apiKey || !locationId) {
                Logger.error('[DDP_CHECK_CONTACT] Missing credentials', { hasApiKey: !!apiKey, hasLocationId: !!locationId });
                return { id, ok: false, error: 'DDP GHL credentials not configured' };
            }
            Logger.info('[DDP_CHECK_CONTACT] Searching contact by phone', { callId, phone });
            const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(phone)}`;
            const resp = await fetch(url, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' },
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[DDP_CHECK_CONTACT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            const contact = data.contacts?.[0];
            if (!contact) {
                Logger.info('[DDP_CHECK_CONTACT] Contact not found', { callId, phone });
                return {
                    id, ok: true,
                    data: { found: false, phone, message: 'No contact found for this phone number. Ask the caller for first name and last name before calling ddp_create_contact.' },
                };
            }
            const firstName = (contact.firstName ?? '').trim();
            const lastName = (contact.lastName ?? '').trim();
            const email = (contact.email ?? '').trim();
            const tags = Array.isArray(contact.tags) ? contact.tags : [];
            const normalizedTags = tags.filter((t) => typeof t === 'string').map(t => t.toLowerCase());
            const wasTransferred = normalizedTags.includes('call_transferred');
            const wasTransferredToSupport = normalizedTags.includes('support_transferred');
            const isMember = normalizedTags.includes('ddp member active list');
            const isGhostContact = !firstName && !lastName && !email;
            if (isGhostContact) {
                Logger.info('[DDP_CHECK_CONTACT] Ghost contact detected (empty name/email) — treating as not found', {
                    callId, contactId: contact.id, phone,
                });
                return {
                    id, ok: true,
                    data: {
                        found: false,
                        phone,
                        message: 'No usable contact found for this phone number. Ask the caller for first name and last name before calling ddp_create_contact.',
                    },
                };
            }
            Logger.info('[DDP_CHECK_CONTACT] Contact found', { callId, contactId: contact.id });
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    contactId: contact.id,
                    firstName: existing.firstName || firstName,
                    lastName: existing.lastName || lastName,
                    email: existing.email || email,
                    phone: existing.phone || contact.phone || '',
                });
            }
            return {
                id, ok: true,
                data: {
                    found: true,
                    contactId: contact.id,
                    firstName,
                    lastName,
                    email,
                    phone: contact.phone ?? '',
                    tags,
                    wasTransferred,
                    wasTransferredToSupport,
                    isMember,
                    ...(isMember ? {
                        message: 'This caller is an existing DDP member. Skip discovery, qualification, persona match, and value hook. Greet them by name, ask what they need help with, then call ddp_mark_transferred_support followed by transfer_call_tool_ddp_support.',
                    } : wasTransferred ? {
                        message: 'This caller was previously transferred to a live agent who did not answer. Do not run the full discovery script — offer to book a callback using check_callback_availability_inbound and schedule_callback_inbound.',
                    } : {}),
                },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[DDP_CHECK_CONTACT] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Check contact failed: ${msg}` };
        }
    }
    // ── DDP: Create contact ────────────────────────────────────────────
    async handleDdpCreateContact(id, args, callId, assistantId) {
        try {
            const validatedArgs = DdpCreateContactArgsSchema.parse(args);
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            const locationId = (assistantId && ClientConfigManager.getLocationId(assistantId)) || process.env.GHL_LOCATION_ID;
            if (!apiKey || !locationId) {
                Logger.error('[DDP_CREATE_CONTACT] Missing credentials', { hasApiKey: !!apiKey, hasLocationId: !!locationId });
                return { id, ok: false, error: 'DDP GHL credentials not configured' };
            }
            Logger.info('[DDP_CREATE_CONTACT] Upserting contact', { callId, phone: validatedArgs.phone });
            const body = { locationId, phone: validatedArgs.phone };
            if (validatedArgs.firstName)
                body.firstName = validatedArgs.firstName;
            if (validatedArgs.lastName)
                body.lastName = validatedArgs.lastName;
            if (validatedArgs.email)
                body.email = validatedArgs.email;
            const resp = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[DDP_CREATE_CONTACT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            const contact = data.contact ?? data;
            const wasNew = data.new === true;
            Logger.info('[DDP_CREATE_CONTACT] Contact upserted', { callId, contactId: contact.id, wasNew });
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    contactId: contact.id,
                    firstName: contact.firstName || validatedArgs.firstName || '',
                    lastName: contact.lastName || validatedArgs.lastName || '',
                    email: contact.email || validatedArgs.email || '',
                    phone: contact.phone || validatedArgs.phone || '',
                });
            }
            return {
                id, ok: true,
                data: {
                    created: true,
                    contactId: contact.id,
                    firstName: contact.firstName ?? '',
                    lastName: contact.lastName ?? '',
                    email: contact.email ?? '',
                    phone: contact.phone ?? '',
                },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[DDP_CREATE_CONTACT] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Create contact failed: ${msg}` };
        }
    }
    // ── Generic: Check if contact exists (multi-client) ────────────────
    async handleCheckContact(id, args, callId, assistantId, customerPhone) {
        try {
            const validatedArgs = CheckContactArgsSchema.parse(args);
            const search = customerPhone || validatedArgs.phone || validatedArgs.query;
            if (!search) {
                return { id, ok: false, error: 'A phone or query is required to check a contact' };
            }
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            const locationId = (assistantId && ClientConfigManager.getLocationId(assistantId)) || process.env.GHL_LOCATION_ID;
            if (!apiKey || !locationId) {
                Logger.error('[CHECK_CONTACT] Missing credentials', { hasApiKey: !!apiKey, hasLocationId: !!locationId });
                return { id, ok: false, error: 'GHL credentials not configured' };
            }
            Logger.info('[CHECK_CONTACT] Searching contact', { callId, assistantId, search });
            const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&query=${encodeURIComponent(search)}`;
            const resp = await fetch(url, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' },
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[CHECK_CONTACT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            const contact = data.contacts?.[0];
            if (!contact) {
                Logger.info('[CHECK_CONTACT] Contact not found', { callId, search });
                return { id, ok: true, data: { found: false, query: search } };
            }
            const firstName = (contact.firstName ?? '').trim();
            const lastName = (contact.lastName ?? '').trim();
            const email = (contact.email ?? '').trim();
            const tags = Array.isArray(contact.tags) ? contact.tags : [];
            const isGhostContact = !firstName && !lastName && !email;
            if (isGhostContact) {
                Logger.info('[CHECK_CONTACT] Ghost contact detected — treating as not found', { callId, contactId: contact.id, search });
                return { id, ok: true, data: { found: false, query: search } };
            }
            Logger.info('[CHECK_CONTACT] Contact found', { callId, contactId: contact.id });
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    contactId: contact.id,
                    firstName: existing.firstName || firstName,
                    lastName: existing.lastName || lastName,
                    email: existing.email || email,
                    phone: existing.phone || contact.phone || '',
                });
            }
            return {
                id, ok: true,
                data: {
                    found: true,
                    contactId: contact.id,
                    firstName,
                    lastName,
                    name: `${firstName} ${lastName}`.trim(),
                    email,
                    phone: contact.phone ?? '',
                    tags,
                },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[CHECK_CONTACT] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Check contact failed: ${msg}` };
        }
    }
    // ── Generic: Create / upsert contact (multi-client) ────────────────
    async handleCreateContact(id, args, callId, assistantId) {
        try {
            const validatedArgs = CreateContactArgsSchema.parse(args);
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            const locationId = (assistantId && ClientConfigManager.getLocationId(assistantId)) || process.env.GHL_LOCATION_ID;
            if (!apiKey || !locationId) {
                Logger.error('[CREATE_CONTACT] Missing credentials', { hasApiKey: !!apiKey, hasLocationId: !!locationId });
                return { id, ok: false, error: 'GHL credentials not configured' };
            }
            Logger.info('[CREATE_CONTACT] Upserting contact', { callId, assistantId, phone: validatedArgs.phone });
            const body = { locationId, phone: validatedArgs.phone };
            if (validatedArgs.firstName)
                body.firstName = validatedArgs.firstName;
            if (validatedArgs.lastName)
                body.lastName = validatedArgs.lastName;
            if (validatedArgs.email)
                body.email = validatedArgs.email;
            const resp = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[CREATE_CONTACT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            const contact = data.contact ?? data;
            const wasNew = data.new === true;
            Logger.info('[CREATE_CONTACT] Contact upserted', { callId, contactId: contact.id, wasNew });
            if (callId) {
                const existing = (await this.stateStorage.getCallMetadata(callId)) || {};
                await this.stateStorage.storeCallMetadata(callId, {
                    ...existing,
                    contactId: contact.id,
                    firstName: contact.firstName || validatedArgs.firstName || '',
                    lastName: contact.lastName || validatedArgs.lastName || '',
                    email: contact.email || validatedArgs.email || '',
                    phone: contact.phone || validatedArgs.phone || '',
                });
            }
            return {
                id, ok: true,
                data: {
                    created: true,
                    wasNew,
                    contactId: contact.id,
                    firstName: contact.firstName ?? '',
                    lastName: contact.lastName ?? '',
                    email: contact.email ?? '',
                    phone: contact.phone ?? '',
                },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[CREATE_CONTACT] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Create contact failed: ${msg}` };
        }
    }
    // ── DDP: Mark contact as transferred ───────────────────────────────
    async handleDdpMarkTransferred(id, args, callId, assistantId) {
        try {
            const validatedArgs = DdpMarkTransferredArgsSchema.parse(args);
            let contactId = validatedArgs.contactId;
            if (!contactId && callId) {
                const metadata = await this.stateStorage.getCallMetadata(callId);
                contactId = metadata?.contactId;
            }
            if (!contactId) {
                Logger.error('[DDP_MARK_TRANSFERRED] Missing contactId', { callId });
                return { id, ok: false, error: 'contactId is required (none provided and none in call metadata).' };
            }
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            if (!apiKey) {
                Logger.error('[DDP_MARK_TRANSFERRED] Missing credentials', { hasApiKey: !!apiKey });
                return { id, ok: false, error: 'DDP GHL credentials not configured' };
            }
            Logger.info('[DDP_MARK_TRANSFERRED] Adding call_transferred tag', { callId, contactId });
            const resp = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tags: ['call_transferred'] }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[DDP_MARK_TRANSFERRED] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            Logger.info('[DDP_MARK_TRANSFERRED] Tag added', { callId, contactId });
            return {
                id, ok: true,
                data: { tagged: true, contactId, tag: 'call_transferred' },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[DDP_MARK_TRANSFERRED] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Mark transferred failed: ${msg}` };
        }
    }
    // ── DDP: Mark caller transferred to customer support ──────────────
    async handleDdpMarkTransferredSupport(id, args, callId, assistantId) {
        try {
            const validatedArgs = DdpMarkTransferredSupportArgsSchema.parse(args);
            let contactId = validatedArgs.contactId;
            if (!contactId && callId) {
                const metadata = await this.stateStorage.getCallMetadata(callId);
                contactId = metadata?.contactId;
            }
            if (!contactId) {
                Logger.error('[DDP_MARK_TRANSFERRED_SUPPORT] Missing contactId', { callId });
                return { id, ok: false, error: 'contactId is required (none provided and none in call metadata).' };
            }
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            if (!apiKey) {
                Logger.error('[DDP_MARK_TRANSFERRED_SUPPORT] Missing credentials', { hasApiKey: !!apiKey });
                return { id, ok: false, error: 'DDP GHL credentials not configured' };
            }
            Logger.info('[DDP_MARK_TRANSFERRED_SUPPORT] Adding support_transferred tag', { callId, contactId });
            const resp = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/tags`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tags: ['support_transferred'] }),
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[DDP_MARK_TRANSFERRED_SUPPORT] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            Logger.info('[DDP_MARK_TRANSFERRED_SUPPORT] Tag added', { callId, contactId });
            return {
                id, ok: true,
                data: { tagged: true, contactId, tag: 'support_transferred' },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[DDP_MARK_TRANSFERRED_SUPPORT] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Mark transferred support failed: ${msg}` };
        }
    }
    // ── Send text guide (triggers a GHL workflow that texts the guide) ──
    async handleSendTextGuide(id, args, callId, assistantId) {
        try {
            const validatedArgs = SendTextGuideArgsSchema.parse(args);
            let contactId = validatedArgs.contactId;
            if (!contactId && callId) {
                const metadata = await this.stateStorage.getCallMetadata(callId);
                contactId = metadata?.contactId;
            }
            if (!contactId) {
                Logger.error('[SEND_TEXT_GUIDE] Missing contactId', { callId });
                return { id, ok: false, error: 'contactId is required (none provided and none in call metadata).' };
            }
            const apiKey = (assistantId && ClientConfigManager.getGHLApiKey(assistantId)) || process.env.GHL_API_KEY;
            if (!apiKey) {
                Logger.error('[SEND_TEXT_GUIDE] Missing credentials', { hasApiKey: !!apiKey });
                return { id, ok: false, error: 'GHL credentials not configured' };
            }
            // Route to the matching guide workflow. A multi-program frontdesk sends
            // guide_type; single-program clients omit it and get the default guide.
            const workflowId = assistantId
                ? (validatedArgs.guide_type === 'BACK_NECK'
                    ? ClientConfigManager.getBackNeckGuideWorkflowId(assistantId)
                    : ClientConfigManager.getGuideWorkflowId(assistantId))
                : undefined;
            if (!workflowId) {
                Logger.error('[SEND_TEXT_GUIDE] Guide workflow not configured', { callId, assistantId, guideType: validatedArgs.guide_type });
                return { id, ok: false, error: 'GUIDE_WORKFLOW_NOT_CONFIGURED' };
            }
            Logger.info('[SEND_TEXT_GUIDE] Triggering guide workflow', { callId, contactId, workflowId, guideType: validatedArgs.guide_type });
            const resp = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/workflow/${workflowId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Version': '2021-07-28',
                    'Content-Type': 'application/json',
                },
            });
            const data = await resp.json();
            if (!resp.ok) {
                Logger.error('[SEND_TEXT_GUIDE] GHL API error', { status: resp.status, data });
                return { id, ok: false, error: `GHL error: ${JSON.stringify(data)}` };
            }
            Logger.info('[SEND_TEXT_GUIDE] Guide workflow triggered', { callId, contactId, workflowId });
            return {
                id, ok: true,
                data: { sent: true, contactId },
            };
        }
        catch (error) {
            if (error instanceof ZodError) {
                return { id, ok: false, error: `Invalid arguments: ${error.issues.map(i => i.message).join(', ')}` };
            }
            const msg = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[SEND_TEXT_GUIDE] Error', { id, callId, error: msg });
            return { id, ok: false, error: `Send text guide failed: ${msg}` };
        }
    }
    /** Safely convert a value that might be a string or array to a readable string. */
    stringifyField(value) {
        if (value === null || value === undefined)
            return '';
        if (typeof value === 'string')
            return value;
        if (Array.isArray(value))
            return value.join(', ');
        return String(value);
    }
    handleCallEnded(message) {
        Logger.info('Call ended', {
            callId: message.call?.id,
            endedReason: message.endedReason,
        });
        return {
            ok: true,
            message: 'Call ended event processed',
        };
    }
    async handleEndOfCallReport(message) {
        const recordingUrl = message.call?.recordingUrl || message.recordingUrl;
        const assistantId = message.call?.assistantId;
        // Support both legacy summaryPlan and new structured output ("Call Summary" schema)
        // Note: structured outputs are NOT in the webhook — they are fetched from the VAPI API below
        let callSummary = message.analysis?.summary ||
            message.analysis?.['Call Summary'] ||
            undefined;
        Logger.info('End of call report received', {
            callId: message.call?.id,
            assistantId,
            timestamp: message.timestamp,
            endedReason: message.endedReason,
            duration: message.duration,
            cost: message.cost,
            analysis: message.analysis ? 'Analysis included' : 'Analysis pending',
            hasRecording: !!recordingUrl,
        });
        // Set assistant ID in GHL connector if available
        if (assistantId) {
            this.ghlConnector.setAssistantId(assistantId);
            Logger.info('[END_OF_CALL] Assistant ID set for GHL operations', {
                assistantId,
                callId: message.call?.id,
            });
        }
        // Store the summary from end-of-call-report if available
        if (message.call?.id && callSummary) {
            await this.stateStorage.storeCallSummary(message.call.id, callSummary);
            Logger.info('[END_OF_CALL] Summary stored in persistent storage', {
                callId: message.call.id,
                summaryLength: callSummary.length,
            });
        }
        // Upload recording to Slack IMMEDIATELY (await for Vercel serverless)
        if (recordingUrl && message.call?.id && this.slackService) {
            try {
                Logger.info('[END_OF_CALL] Uploading recording to Slack', { callId: message.call.id });
                // DEBUG: Log what's available in the webhook message
                Logger.info('[END_OF_CALL] DEBUG - Webhook message data', {
                    callId: message.call?.id,
                    hasCallMetadata: !!message.call?.metadata,
                    callMetadataKeys: message.call?.metadata ? Object.keys(message.call.metadata) : [],
                    hasGhlInCallMetadata: !!message.call?.metadata?.ghl,
                    ghlMetadataKeys: message.call?.metadata?.ghl ? Object.keys(message.call.metadata.ghl) : [],
                    rawCallMetadata: message.call?.metadata ? JSON.stringify(message.call.metadata).substring(0, 500) : null,
                });
                // Try to use metadata from the webhook message first
                let ghlMetadata = message.call?.metadata?.ghl || null;
                let fullCallData = message.call || null;
                Logger.info('[END_OF_CALL] Using metadata from webhook message', {
                    callId: message.call?.id,
                    hasMessageMetadata: !!message.call?.metadata,
                    hasGhlInMessage: !!ghlMetadata,
                });
                // Always pull from API to get structured outputs (summary); also get GHL metadata if missing
                let apiFetched = false;
                if (!ghlMetadata) {
                    try {
                        Logger.info('[END_OF_CALL] Pulling metadata from API', { callId: message.call.id });
                        const metadataResult = await this.pullCallMetadata(message.call.id);
                        ghlMetadata = metadataResult.ghlMetadata;
                        fullCallData = metadataResult.fullCall || fullCallData;
                        apiFetched = true;
                        // Use structured output summary if no summary from webhook
                        if (!callSummary && metadataResult.structuredSummary) {
                            callSummary = metadataResult.structuredSummary;
                            Logger.info('[END_OF_CALL] Summary from structured outputs', {
                                callId: message.call.id,
                                summaryLength: metadataResult.structuredSummary.length,
                            });
                        }
                        Logger.info('[END_OF_CALL] DEBUG - Metadata fetched from API', {
                            callId: message.call.id,
                            hasGhlMetadata: !!ghlMetadata,
                            hasFullCallData: !!fullCallData,
                            hasStructuredSummary: !!metadataResult.structuredSummary,
                            ghlMetadataKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
                            rawGhlMetadata: ghlMetadata ? JSON.stringify(ghlMetadata).substring(0, 500) : null,
                        });
                    }
                    catch (error) {
                        Logger.warn('[SLACK_UPLOAD] Could not fetch GHL metadata from API', {
                            callId: message.call.id,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
                // If ghlMetadata came from webhook but no summary yet, fetch API just for structured outputs
                if (!apiFetched && !callSummary) {
                    try {
                        const metadataResult = await this.pullCallMetadata(message.call.id);
                        if (metadataResult.structuredSummary) {
                            callSummary = metadataResult.structuredSummary;
                            Logger.info('[END_OF_CALL] Summary from structured outputs (secondary fetch)', {
                                callId: message.call.id,
                                summaryLength: metadataResult.structuredSummary.length,
                            });
                        }
                    }
                    catch (error) {
                        Logger.warn('[END_OF_CALL] Could not fetch structured outputs', {
                            callId: message.call.id,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
                // If still no GHL metadata, check stateStorage for data captured during tool calls
                if (!ghlMetadata) {
                    try {
                        const storedMetadata = await this.stateStorage.getCallMetadata(message.call.id);
                        if (storedMetadata?.contactId || storedMetadata?.firstName) {
                            ghlMetadata = {
                                contactId: storedMetadata.contactId || null,
                                locationId: storedMetadata.locationId || null,
                                contact: {
                                    firstName: storedMetadata.firstName || '',
                                    lastName: storedMetadata.lastName || '',
                                    name: `${storedMetadata.firstName || ''} ${storedMetadata.lastName || ''}`.trim(),
                                    email: storedMetadata.email || '',
                                    phone: storedMetadata.phone || '',
                                },
                            };
                            Logger.info('[END_OF_CALL] Built ghlMetadata from stateStorage tool call data', {
                                callId: message.call.id,
                                contactId: ghlMetadata.contactId,
                                firstName: storedMetadata.firstName,
                            });
                        }
                    }
                    catch (error) {
                        Logger.warn('[END_OF_CALL] Could not read stateStorage metadata', {
                            callId: message.call.id,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
                // Last resort: look up caller phone directly in GHL
                if (!ghlMetadata) {
                    const callerPhone = message.call?.customer?.number;
                    if (callerPhone) {
                        try {
                            Logger.info('[END_OF_CALL] Looking up caller by phone in GHL', {
                                callId: message.call.id,
                                phone: '***' + callerPhone.slice(-4),
                            });
                            const contactResult = await this.ghlConnector.lookupContactByPhone(callerPhone);
                            if (contactResult) {
                                ghlMetadata = contactResult;
                                Logger.info('[END_OF_CALL] GHL contact found via phone lookup', {
                                    callId: message.call.id,
                                    contactId: contactResult.contactId,
                                });
                            }
                        }
                        catch (error) {
                            Logger.warn('[END_OF_CALL] GHL phone lookup failed', {
                                callId: message.call.id,
                                error: error instanceof Error ? error.message : 'Unknown error',
                            });
                        }
                    }
                }
                await this.uploadRecordingToSlack(recordingUrl, message.call.id, assistantId, ghlMetadata, fullCallData, {
                    duration: message.duration,
                    cost: message.cost,
                    ...(callSummary !== undefined && { summary: callSummary }),
                    sentiment: message.analysis?.sentiment,
                });
                Logger.info('[END_OF_CALL] Recording uploaded to Slack successfully', { callId: message.call.id });
                // Send summary note to GHL contact if we have a contactId
                const contactId = ghlMetadata?.contactId || ghlMetadata?.contact?.id;
                if (contactId) {
                    try {
                        // Store summary so sendFinalSummaryNote can read it
                        if (callSummary) {
                            await this.stateStorage.storeCallSummary(message.call.id, callSummary);
                        }
                        await this.sendFinalSummaryNote(message.call.id, { contactId, metadata: ghlMetadata });
                        Logger.info('[END_OF_CALL] Summary note sent to GHL', { callId: message.call.id, contactId });
                    }
                    catch (error) {
                        Logger.error('[END_OF_CALL] Failed to send summary note', {
                            callId: message.call.id,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
            }
            catch (error) {
                Logger.error('[SLACK_UPLOAD] Failed to upload recording', {
                    callId: message.call.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        // Process metadata and GHL IMMEDIATELY (no setTimeout for Vercel serverless)
        if (message.call?.id) {
            Logger.info('[END_OF_CALL] Processing metadata immediately for Vercel serverless', {
                callId: message.call.id,
                hasAnalysis: !!message.analysis,
            });
            try {
                // Execute metadata pull immediately instead of scheduling with setTimeout
                await this.pullAndProcessGhlMetadata(message.call.id);
                Logger.info('[END_OF_CALL] Metadata processing completed', { callId: message.call.id });
            }
            catch (error) {
                Logger.error('[END_OF_CALL] Metadata processing failed', {
                    callId: message.call.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        // Process the report regardless of analysis status
        this.processEndOfCallReport(message);
        return {
            ok: true,
            message: 'End of call report processed',
        };
    }
    // NOTE: scheduleAnalysisPolling and pollForCallAnalysis removed
    // These functions used setTimeout which doesn't work in Vercel serverless
    // Metadata is now processed immediately in handleEndOfCallReport
    processEndOfCallReport(message) {
        // Add your business logic here
        // For example: save to database, send notifications, update CRM, etc.
        Logger.info('Processing end of call report', {
            callId: message.call?.id,
            hasAnalysis: !!message.analysis,
        });
    }
    async handleTranscript(message) {
        Logger.info('Transcript received', {
            callId: message.call?.id,
            timestamp: message.timestamp,
            role: message.role,
            isFinal: message.isFinal,
            transcriptLength: message.transcript?.length || 0,
            transcript: message.isFinal ? message.transcript : message.transcript?.substring(0, 100) + '...',
        });
        // Store transcript for later validation of appointment times
        if (message.call?.id && message.transcript) {
            await this.stateStorage.storeTranscript(message.call.id, message.transcript, message.role);
        }
        // Log transcript info but don't save to files - only send summary note to GHL
        if (message.call?.id && message.transcript && message.isFinal) {
            Logger.info('[TRANSCRIPT] Final transcript received, will be included in GHL summary note', {
                callId: message.call.id,
                transcriptLength: message.transcript.length,
            });
        }
        return {
            ok: true,
            message: 'Transcript processed',
        };
    }
    handleStatusUpdate(message) {
        Logger.info('Status update received', {
            callId: message.call?.id,
            timestamp: message.timestamp,
            status: message.status,
            details: message.details,
            metadata: message.metadata,
        });
        // You can add custom logic here to process status updates
        // For example: update call status in database, send real-time notifications,
        // update UI dashboards, trigger workflows based on status changes, etc.
        return {
            ok: true,
            message: 'Status update processed',
        };
    }
    handleMetadata(message) {
        Logger.info('Metadata received', {
            callId: message.call?.id,
            timestamp: message.timestamp,
            source: message.source,
            category: message.category,
            metadataKeys: Object.keys(message.metadata || {}),
            metadata: message.metadata,
        });
        // You can add custom logic here to process metadata
        // For example: save metadata to database, trigger analytics,
        // update call context, enrich customer profiles, etc.
        return {
            ok: true,
            message: 'Metadata processed',
        };
    }
    async handleGhlTool(message) {
        Logger.info('GHL Tool request received', {
            callId: message.call?.id,
            timestamp: message.timestamp,
            toolName: message.tool?.name,
            toolAction: message.tool?.action,
            parameters: message.tool?.parameters,
            metadata: message.metadata,
        });
        try {
            // Dispatch to appropriate GHL connector method based on tool name
            const result = await this.dispatchGhlTool(message.tool, message.call?.id);
            return {
                ok: true,
                message: 'GHL tool executed successfully',
                results: [result],
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error executing GHL tool', {
                toolName: message.tool?.name,
                error: errorMessage,
                callId: message.call?.id,
            });
            return {
                ok: false,
                message: 'GHL tool execution failed',
                results: [{
                        id: message.call?.id || 'unknown',
                        ok: false,
                        error: errorMessage,
                    }],
            };
        }
    }
    async dispatchGhlTool(tool, callId) {
        const { name, parameters = {}, action } = tool;
        const id = callId || `ghl_tool_${Date.now()}`;
        Logger.info('Dispatching GHL tool', { id, name, action, parameters });
        switch (name) {
            case 'send_sms':
                return await this.handleSendSms(id, parameters);
            case 'upsert_contact':
                return await this.handleUpsertContact(id, parameters);
            case 'add_tag':
                return await this.handleAddTag(id, parameters);
            case 'add_note':
                return await this.handleAddNote(id, parameters);
            case 'update_stage':
                return await this.handleUpdateStage(id, parameters);
            // Add more GHL-specific tools here
            case 'create_opportunity':
                return await this.handleCreateOpportunity(id, parameters);
            case 'update_contact':
                return await this.handleUpdateContact(id, parameters);
            case 'send_email':
                return await this.handleSendEmail(id, parameters);
            default:
                Logger.warn('Unknown GHL tool', { id, name });
                return {
                    id,
                    ok: false,
                    error: `Unknown GHL tool: ${name}`,
                };
        }
    }
    // Placeholder methods for additional GHL tools - implement as needed
    async handleCreateOpportunity(id, args) {
        Logger.info('Creating opportunity (placeholder)', { id, args });
        // TODO: Implement opportunity creation logic
        return {
            id,
            ok: true,
            data: { message: 'Opportunity creation not implemented yet' },
        };
    }
    async handleUpdateContact(id, args) {
        Logger.info('Updating contact (placeholder)', { id, args });
        // TODO: Implement contact update logic (different from upsert)
        return {
            id,
            ok: true,
            data: { message: 'Contact update not implemented yet' },
        };
    }
    async handleSendEmail(id, args) {
        Logger.info('Sending email (placeholder)', { id, args });
        // TODO: Implement email sending logic
        return {
            id,
            ok: true,
            data: { message: 'Email sending not implemented yet' },
        };
    }
    // New methods for call metadata polling - added without breaking existing functionality
    async pullCallMetadata(callId) {
        try {
            Logger.info('[METADATA_PULL] Initiating call metadata pull', { callId });
            const result = await this.vapiApiClient.getCallMetadata(callId);
            Logger.info('[METADATA_PULL] Call metadata pull completed', {
                callId,
                hasGhlMetadata: !!result.ghlMetadata,
                metadataKeys: result.metadata ? Object.keys(result.metadata) : [],
            });
            return result;
        }
        catch (error) {
            Logger.error('[METADATA_PULL] Call metadata pull failed', {
                callId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async pullAndProcessGhlMetadata(callId) {
        try {
            Logger.info('[GHL_METADATA_PULL] Starting GHL metadata processing', { callId });
            const metadataResult = await this.pullCallMetadata(callId);
            const ghlMetadata = metadataResult.ghlMetadata;
            if (!ghlMetadata) {
                Logger.warn('[GHL_METADATA_PULL] No GHL metadata found', { callId });
                return {
                    callId,
                    success: false,
                    reason: 'No GHL metadata found',
                    metadata: metadataResult.metadata,
                };
            }
            Logger.info('[GHL_METADATA_PULL] GHL metadata found, processing', {
                callId,
                ghlKeys: Object.keys(ghlMetadata),
                ghlMetadata: ghlMetadata,
                contactId: ghlMetadata.contactId,
                source: ghlMetadata.source,
            });
            // Get assistant ID from full call data
            const assistantId = metadataResult.fullCall?.assistantId;
            // Process the GHL metadata - you can add custom logic here
            const processedResult = await this.processGhlMetadata(callId, ghlMetadata, assistantId);
            return {
                callId,
                success: true,
                ghlMetadata,
                processedResult,
                fullMetadata: metadataResult.metadata,
            };
        }
        catch (error) {
            Logger.error('[GHL_METADATA_PULL] GHL metadata processing failed', {
                callId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async processGhlMetadata(callId, ghlMetadata, assistantId) {
        try {
            Logger.info('[GHL_METADATA_PROCESS] Processing GHL metadata', {
                callId,
                assistantId,
                metadataKeys: Object.keys(ghlMetadata),
                fullGhlMetadata: ghlMetadata,
                contactId: ghlMetadata.contactId,
                source: ghlMetadata.source,
            });
            // Set assistant ID in GHL connector if available
            if (assistantId) {
                this.ghlConnector.setAssistantId(assistantId);
                Logger.info('[GHL_METADATA_PROCESS] Assistant ID set for GHL operations', {
                    assistantId,
                    callId,
                });
            }
            // Add your custom GHL metadata processing logic here
            // For example: trigger GHL actions based on metadata
            const results = [];
            // Example: If there's contact info in metadata, upsert it
            if (ghlMetadata.contact) {
                Logger.info('[GHL_METADATA_PROCESS] Found contact data in metadata', {
                    callId,
                    contactInfo: ghlMetadata.contact,
                });
                try {
                    const contactResult = await this.ghlConnector.upsertContact(`metadata_${callId}_contact`, ghlMetadata.contact);
                    results.push({
                        action: 'upsert_contact',
                        result: contactResult,
                    });
                }
                catch (error) {
                    Logger.error('[GHL_METADATA_PROCESS] Contact upsert failed', {
                        callId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            // Example: If there are tags in metadata, add them
            if (ghlMetadata.tags && Array.isArray(ghlMetadata.tags)) {
                Logger.info('[GHL_METADATA_PROCESS] Found tags in metadata', {
                    callId,
                    tags: ghlMetadata.tags,
                });
                for (const tag of ghlMetadata.tags) {
                    try {
                        const tagResult = await this.ghlConnector.addTag(`metadata_${callId}_tag_${tag}`, {
                            tag,
                            phone: ghlMetadata.contact?.phone,
                            email: ghlMetadata.contact?.email,
                            apiKey: 'primary',
                        });
                        results.push({
                            action: 'add_tag',
                            tag,
                            result: tagResult,
                        });
                    }
                    catch (error) {
                        Logger.error('[GHL_METADATA_PROCESS] Tag addition failed', {
                            callId,
                            tag,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
            }
            // Log the specific contactId if it exists and trigger final note with summary
            if (ghlMetadata.contactId) {
                Logger.info('[GHL_METADATA_PROCESS] Contact ID found in metadata', {
                    callId,
                    contactId: ghlMetadata.contactId,
                    canProcessWithGHL: true,
                });
                // Trigger final summary note (only once per call)
                try {
                    await this.sendFinalSummaryNote(callId, {
                        contactId: ghlMetadata.contactId,
                        metadata: ghlMetadata,
                    });
                }
                catch (error) {
                    Logger.error('[GHL_METADATA_PROCESS] Failed to send final summary note', {
                        callId,
                        contactId: ghlMetadata.contactId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            Logger.info('[GHL_METADATA_PROCESS] GHL metadata processing completed', {
                callId,
                resultsCount: results.length,
                contactId: ghlMetadata.contactId,
            });
            return {
                processed: true,
                actions: results,
                originalMetadata: ghlMetadata,
                extractedContactId: ghlMetadata.contactId,
            };
        }
        catch (error) {
            Logger.error('[GHL_METADATA_PROCESS] Failed to process GHL metadata', {
                callId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    // @deprecated - No longer used in Vercel serverless (setTimeout doesn't work)
    // Kept for backwards compatibility with non-serverless environments
    async scheduleMetadataPull(callId, delays = [30000, 60000, 120000]) {
        Logger.info('[METADATA_SCHEDULE] Scheduling metadata pulls', {
            callId,
            delays,
            attemptsCount: delays.length,
        });
        delays.forEach((delay, index) => {
            setTimeout(async () => {
                try {
                    Logger.info('[METADATA_SCHEDULE] Executing scheduled metadata pull', {
                        callId,
                        attempt: index + 1,
                        delay,
                    });
                    await this.pullAndProcessGhlMetadata(callId);
                    Logger.info('[METADATA_SCHEDULE] Scheduled metadata pull completed', {
                        callId,
                        attempt: index + 1,
                    });
                }
                catch (error) {
                    Logger.error('[METADATA_SCHEDULE] Scheduled metadata pull failed', {
                        callId,
                        attempt: index + 1,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }, delay);
        });
    }
    // Send final summary note (only once per call) - NO setTimeout for Vercel serverless
    async sendFinalSummaryNote(callId, data) {
        // Check if we already sent a note for this call (using persistent storage)
        const alreadySent = await this.stateStorage.wasNoteSent(callId, data.contactId);
        if (alreadySent) {
            Logger.info('[FINAL_SUMMARY] Note already sent for this call, skipping', {
                callId,
                contactId: data.contactId
            });
            return;
        }
        // Mark this call as having a note sent (in persistent storage)
        await this.stateStorage.markNoteSent(callId, data.contactId);
        // Execute IMMEDIATELY (no setTimeout for Vercel serverless compatibility)
        try {
            Logger.info('[FINAL_SUMMARY] Sending final summary note', {
                callId,
                contactId: data.contactId,
            });
            // Try to get additional data
            let finalData = { ...data };
            try {
                const metadataResult = await this.pullCallMetadata(callId);
                if (metadataResult.ghlMetadata) {
                    finalData.metadata = finalData.metadata || metadataResult.ghlMetadata;
                }
            }
            catch (error) {
                Logger.warn('[FINAL_SUMMARY] Could not fetch additional metadata', {
                    callId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
            // Create summary note content with the actual summary from end-of-call-report
            const timestamp = new Date().toISOString();
            const storedSummary = await this.stateStorage.getCallSummary(callId);
            Logger.info('[FINAL_SUMMARY] Retrieved summary from persistent storage', {
                callId,
                summaryFound: !!storedSummary,
            });
            const summaryContent = [
                `📞 CALL COMPLETED`,
                `Call ID: ${callId}`,
                `Timestamp: ${timestamp}`,
                ``,
                `📊 SUMMARY:`,
                `• Call processed successfully`,
                storedSummary ? `• ${storedSummary}` : `• There is no summary available from the call analysis`
            ].join('\n');
            // Send the summary note to GHL
            const ghlResult = await this.ghlConnector.addNoteByContactIdViaAPI(`summary_${callId}`, data.contactId, summaryContent);
            if (ghlResult.ok) {
                Logger.info('[FINAL_SUMMARY] Summary note sent to GHL successfully', {
                    callId,
                    contactId: data.contactId,
                    noteId: ghlResult.data?.note?.id,
                });
            }
            else {
                Logger.error('[FINAL_SUMMARY] Failed to send summary note to GHL', {
                    callId,
                    contactId: data.contactId,
                    error: ghlResult.error,
                });
            }
        }
        catch (error) {
            Logger.error('[FINAL_SUMMARY] Error sending summary note', {
                callId,
                contactId: data.contactId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    /**
     * Uploads a recording to Slack with context information
     */
    async uploadRecordingToSlack(recordingUrl, callId, assistantId, ghlMetadata, fullCallData, context) {
        if (!this.slackService) {
            Logger.warn('[SLACK_UPLOAD] Slack service not available', { callId });
            return;
        }
        try {
            Logger.info('[SLACK_UPLOAD] Starting recording upload to Slack', {
                callId,
                recordingUrl,
                hasContext: !!context,
                hasAssistantId: !!assistantId,
                hasGhlMetadata: !!ghlMetadata,
                hasFullCallData: !!fullCallData,
            });
            await this.slackService.uploadRecordingWithContext(recordingUrl, callId, assistantId, ghlMetadata, fullCallData, context);
            Logger.info('[SLACK_UPLOAD] Recording uploaded successfully to Slack', {
                callId,
            });
        }
        catch (error) {
            Logger.error('[SLACK_UPLOAD] Failed to upload recording to Slack', {
                callId,
                recordingUrl,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    /**
     * Test Slack connection
     */
    async testSlackConnection() {
        if (!this.slackService) {
            Logger.warn('[SLACK_TEST] Slack service not available');
            return false;
        }
        try {
            return await this.slackService.testConnection();
        }
        catch (error) {
            Logger.error('[SLACK_TEST] Connection test failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    /**
     * Get storage status for health checks
     */
    getStorageStatus() {
        return this.stateStorage.getStatus();
    }
}
