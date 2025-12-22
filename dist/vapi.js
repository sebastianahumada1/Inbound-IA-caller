import { ZodError } from 'zod';
import { GHLConnector } from './ghl.js';
import { Logger } from './utils/logger.js';
import { VapiApiClient } from './utils/vapi-client.js';
import { SlackService } from './utils/slack-service.js';
import { StateStorage } from './utils/state-storage.js';
import { VapiWebhookBodySchema, SendSmsArgsSchema, UpsertContactArgsSchema, AddTagArgsSchema, AddNoteArgsSchema, UpdateStageArgsSchema, CheckCalendarAvailabilityArgsSchema, ScheduleAppointmentArgsSchema, } from './schemas.js';
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
                const ghlMetadata = message.call?.metadata?.ghl || null;
                Logger.info('[VAPI] Extracted GHL metadata for tool-calls', {
                    hasGhlMetadata: !!ghlMetadata,
                    ghlMetadataKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
                    hasContact: !!ghlMetadata?.contact,
                    contactKeys: ghlMetadata?.contact ? Object.keys(ghlMetadata.contact) : [],
                    contactPhone: ghlMetadata?.contact?.phone,
                    contactPhoneNumber: ghlMetadata?.contact?.phoneNumber,
                    fullGhlMetadata: JSON.stringify(ghlMetadata).substring(0, 500),
                });
                return await this.handleToolCalls(message.toolCallList, assistantId, ghlMetadata);
            case 'call.ended':
                return this.handleCallEnded(message);
            case 'end-of-call-report':
                return await this.handleEndOfCallReport(message);
            case 'transcript':
                return this.handleTranscript(message);
            case 'status-update':
                return this.handleStatusUpdate(message);
            case 'metadata':
                return this.handleMetadata(message);
            case 'ghl_tool':
                return await this.handleGhlTool(message);
            default:
                Logger.warn('Unknown message type', { type: message.type });
                return {
                    ok: true,
                    message: 'Message type not handled',
                };
        }
    }
    async handleToolCalls(toolCallList, assistantId, ghlMetadata) {
        Logger.info('Processing tool calls', {
            count: toolCallList.length,
            assistantId,
            hasGhlMetadata: !!ghlMetadata,
        });
        // Set assistant ID in GHL connector if available
        if (assistantId) {
            this.ghlConnector.setAssistantId(assistantId);
        }
        const vapiResults = [];
        // Process tool calls sequentially to avoid overwhelming GHL
        for (const toolCall of toolCallList) {
            const result = await this.dispatchToolCall(toolCall, ghlMetadata);
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
    async dispatchToolCall(toolCall, ghlMetadata) {
        const { id, name, arguments: args } = toolCall;
        Logger.info('Dispatching tool call', { id, name, args, hasGhlMetadata: !!ghlMetadata });
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
                    return await this.handleCheckCalendarAvailability(id, args);
                case 'schedule_appointment':
                    return await this.handleScheduleAppointment(id, args, ghlMetadata);
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
    async handleCheckCalendarAvailability(id, args) {
        try {
            const validatedArgs = CheckCalendarAvailabilityArgsSchema.parse(args);
            return await this.ghlConnector.checkCalendarAvailability(id, validatedArgs);
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
    async handleScheduleAppointment(id, args, ghlMetadata) {
        try {
            const validatedArgs = ScheduleAppointmentArgsSchema.parse(args);
            return await this.ghlConnector.scheduleAppointment(id, validatedArgs, ghlMetadata);
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
        if (message.call?.id && message.analysis?.summary) {
            await this.stateStorage.storeCallSummary(message.call.id, message.analysis.summary);
            Logger.info('[END_OF_CALL] Summary stored in persistent storage', {
                callId: message.call.id,
                summaryLength: message.analysis.summary.length,
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
                // If not available in webhook, try pulling from API
                if (!ghlMetadata) {
                    try {
                        Logger.info('[END_OF_CALL] Pulling metadata from API', { callId: message.call.id });
                        const metadataResult = await this.pullCallMetadata(message.call.id);
                        ghlMetadata = metadataResult.ghlMetadata;
                        fullCallData = metadataResult.fullCall || fullCallData;
                        Logger.info('[END_OF_CALL] DEBUG - Metadata fetched from API', {
                            callId: message.call.id,
                            hasGhlMetadata: !!ghlMetadata,
                            hasFullCallData: !!fullCallData,
                            ghlMetadataKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
                            fullCallDataKeys: fullCallData ? Object.keys(fullCallData) : [],
                            fullCallMetadataKeys: fullCallData?.metadata ? Object.keys(fullCallData.metadata) : [],
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
                await this.uploadRecordingToSlack(recordingUrl, message.call.id, assistantId, ghlMetadata, fullCallData, {
                    duration: message.duration,
                    cost: message.cost,
                    summary: message.analysis?.summary,
                    sentiment: message.analysis?.sentiment,
                });
                Logger.info('[END_OF_CALL] Recording uploaded to Slack successfully', { callId: message.call.id });
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
    handleTranscript(message) {
        Logger.info('Transcript received', {
            callId: message.call?.id,
            timestamp: message.timestamp,
            role: message.role,
            isFinal: message.isFinal,
            transcriptLength: message.transcript?.length || 0,
            transcript: message.isFinal ? message.transcript : message.transcript?.substring(0, 100) + '...',
        });
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
