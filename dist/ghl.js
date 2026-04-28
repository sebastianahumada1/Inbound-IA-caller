import { HttpClient } from './utils/http.js';
import { Logger } from './utils/logger.js';
import { ClientConfigManager } from './utils/client-config.js';
export class GHLConnector {
    httpClient;
    defaultWebhookUrl;
    bookingWebhookUrl;
    depositWebhookUrl;
    assistantId = null;
    constructor(assistantId) {
        this.httpClient = new HttpClient();
        this.defaultWebhookUrl = process.env.GHL_INCOMING_WEBHOOK_URL_DEFAULT;
        this.bookingWebhookUrl = process.env.GHL_INCOMING_WEBHOOK_URL_BOOKING;
        this.depositWebhookUrl = process.env.GHL_INCOMING_WEBHOOK_URL_DEPOSIT;
        this.assistantId = assistantId || null;
        if (this.assistantId) {
            const clientName = ClientConfigManager.getClientName(this.assistantId);
            Logger.info('[GHL_CONNECTOR] Initialized for client', {
                assistantId: this.assistantId,
                clientName,
            });
        }
    }
    /**
     * Set the Assistant ID for this connector instance
     */
    setAssistantId(assistantId) {
        this.assistantId = assistantId;
        const clientName = ClientConfigManager.getClientName(assistantId);
        Logger.info('[GHL_CONNECTOR] Assistant ID set', {
            assistantId,
            clientName,
        });
    }
    /**
     * Get the appropriate GHL API Key based on Assistant ID
     */
    getGHLApiKey() {
        if (this.assistantId) {
            const apiKey = ClientConfigManager.getGHLApiKey(this.assistantId);
            if (apiKey) {
                Logger.info('[GHL_CONNECTOR] Using client-specific API key', {
                    assistantId: this.assistantId,
                    clientName: ClientConfigManager.getClientName(this.assistantId),
                });
                return apiKey;
            }
        }
        // Fallback to default API key from environment
        const defaultKey = process.env.GHL_API_KEY;
        if (!defaultKey) {
            Logger.warn('[GHL_CONNECTOR] No API key found for assistant, using default', {
                assistantId: this.assistantId,
            });
        }
        return defaultKey || '';
    }
    /**
     * Get the Calendar ID based on Assistant ID
     */
    getCalendarId() {
        if (this.assistantId) {
            const calendarId = ClientConfigManager.getCalendarId(this.assistantId);
            if (calendarId) {
                Logger.info('[GHL_CONNECTOR] Using client-specific calendar ID', {
                    assistantId: this.assistantId,
                    clientName: ClientConfigManager.getClientName(this.assistantId),
                    calendarId,
                });
                return calendarId;
            }
        }
        Logger.warn('[GHL_CONNECTOR] No calendar ID found for assistant', {
            assistantId: this.assistantId,
        });
        return null;
    }
    /**
     * Get the Callback Calendar ID based on Assistant ID
     */
    getCallbackCalendarId() {
        if (this.assistantId) {
            const callbackCalendarId = ClientConfigManager.getCallbackCalendarId(this.assistantId);
            if (callbackCalendarId) {
                Logger.info('[GHL_CONNECTOR] Using client-specific callback calendar ID', {
                    assistantId: this.assistantId,
                    clientName: ClientConfigManager.getClientName(this.assistantId),
                    callbackCalendarId,
                });
                return callbackCalendarId;
            }
        }
        Logger.warn('[GHL_CONNECTOR] No callback calendar ID found for assistant', {
            assistantId: this.assistantId,
        });
        return null;
    }
    /**
     * Get the Gabriel Calendar ID based on Assistant ID
     */
    getGabrielCalendarId() {
        if (this.assistantId) {
            const gabrielCalendarId = ClientConfigManager.getGabrielCalendarId(this.assistantId);
            if (gabrielCalendarId) {
                Logger.info('[GHL_CONNECTOR] Using client-specific Gabriel calendar ID', {
                    assistantId: this.assistantId,
                    clientName: ClientConfigManager.getClientName(this.assistantId),
                    gabrielCalendarId,
                });
                return gabrielCalendarId;
            }
        }
        Logger.warn('[GHL_CONNECTOR] No Gabriel calendar ID found for assistant', {
            assistantId: this.assistantId,
        });
        return null;
    }
    /**
     * Extract time mentioned by user from transcript
     * Looks for patterns like "9 AM", "3 PM", "2:30 PM", etc.
     */
    extractTimeFromTranscript(transcript) {
        if (!transcript)
            return null;
        // Patterns to match:
        // - "9 AM", "9am", "9:00 AM"
        // - "3 PM", "3pm", "3:30 PM"
        // - "2 o'clock", "2:00"
        const patterns = [
            /(\d{1,2})\s*(?:o'?clock|:00)?\s*(AM|PM|am|pm)/i,
            /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/i,
            /(\d{1,2})\s*(AM|PM|am|pm)/i,
        ];
        for (const pattern of patterns) {
            const match = transcript.match(pattern);
            if (match && match[1]) {
                const hour = parseInt(match[1], 10);
                const minute = match[2] ? parseInt(match[2], 10) : 0;
                const period = (match[3] || match[2])?.toUpperCase();
                // Convert to 24-hour format
                let hour24 = hour;
                if (period === 'PM' && hour !== 12) {
                    hour24 = hour + 12;
                }
                else if (period === 'AM' && hour === 12) {
                    hour24 = 0;
                }
                Logger.info('[TRANSCRIPT_TIME] Extracted time from transcript', {
                    transcript: transcript.substring(0, 200),
                    extracted: { hour, minute, period, hour24 },
                });
                return { hour: hour24, minute, period };
            }
        }
        return null;
    }
    /**
     * Validate and correct appointment time using transcript if available
     * Ensures the time matches what the user actually said
     */
    async correctAppointmentTimeWithTranscript(dateTimeString, callId, stateStorage) {
        // If no callId, use regular correction
        if (!callId || !stateStorage) {
            return this.correctAppointmentTime(dateTimeString);
        }
        try {
            // Get transcript from storage
            const transcript = await stateStorage.getTranscript(callId);
            if (transcript) {
                // Extract time from transcript
                const transcriptTime = this.extractTimeFromTranscript(transcript);
                if (transcriptTime) {
                    // Parse the datetime from AI
                    const aiDate = new Date(dateTimeString);
                    const isUTC = dateTimeString.endsWith('Z');
                    // Get timezone from original or use client's default
                    let timezone = '-05:00'; // Default to EST
                    const timezoneMatch = dateTimeString.match(/([+-]\d{2}:\d{2})$/);
                    if (timezoneMatch && timezoneMatch[1]) {
                        timezone = timezoneMatch[1];
                    }
                    else if (this.assistantId) {
                        // Try to get timezone from client config (if we add it later)
                        // For now, use default based on common timezones
                        const clientName = ClientConfigManager.getClientName(this.assistantId);
                        if (clientName.includes('Texas') || clientName.includes('West Texas')) {
                            timezone = '-06:00'; // Central Time
                        }
                        else if (clientName.includes('ChiroMedix')) {
                            timezone = '-08:00'; // Pacific Time
                        }
                    }
                    // If AI sent UTC, we need to check if it matches transcript when converted to local time
                    let aiHourLocal = aiDate.getHours();
                    if (isUTC) {
                        // Convert UTC to local timezone for comparison
                        // Parse the date as if it were in the client's timezone
                        const localDateStr = dateTimeString.replace('Z', timezone);
                        const localDate = new Date(localDateStr);
                        aiHourLocal = localDate.getHours();
                    }
                    // Compare with transcript time
                    if (aiHourLocal !== transcriptTime.hour) {
                        Logger.warn('[TRANSCRIPT_VALIDATION] Time mismatch detected', {
                            transcriptTime: transcriptTime.hour,
                            aiTimeUTC: isUTC ? aiDate.getHours() : undefined,
                            aiTimeLocal: aiHourLocal,
                            dateTimeString,
                            isUTC,
                        });
                        // Correct the time to match transcript
                        // Use the date from AI but set the hour/minute from transcript
                        const correctedDate = new Date(aiDate);
                        correctedDate.setHours(transcriptTime.hour, transcriptTime.minute, 0, 0);
                        // Reconstruct datetime string with client's timezone
                        const year = correctedDate.getFullYear();
                        const month = String(correctedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(correctedDate.getDate()).padStart(2, '0');
                        const correctedHourStr = String(correctedDate.getHours()).padStart(2, '0');
                        const correctedMinStr = String(correctedDate.getMinutes()).padStart(2, '0');
                        const correctedSecStr = String(correctedDate.getSeconds()).padStart(2, '0');
                        const corrected = `${year}-${month}-${day}T${correctedHourStr}:${correctedMinStr}:${correctedSecStr}${timezone}`;
                        Logger.info('[TRANSCRIPT_VALIDATION] Corrected time based on transcript', {
                            original: dateTimeString,
                            corrected,
                            transcriptTime: transcriptTime.hour,
                            aiTimeLocal: aiHourLocal,
                            timezone,
                        });
                        return corrected;
                    }
                    else {
                        // Time matches, but if it was in UTC, convert to client timezone
                        if (isUTC) {
                            const year = aiDate.getFullYear();
                            const month = String(aiDate.getMonth() + 1).padStart(2, '0');
                            const day = String(aiDate.getDate()).padStart(2, '0');
                            const hourStr = String(transcriptTime.hour).padStart(2, '0');
                            const minStr = String(transcriptTime.minute).padStart(2, '0');
                            const converted = `${year}-${month}-${day}T${hourStr}:${minStr}:00${timezone}`;
                            Logger.info('[TRANSCRIPT_VALIDATION] Converted UTC to client timezone', {
                                original: dateTimeString,
                                converted,
                                timezone,
                            });
                            return converted;
                        }
                        Logger.info('[TRANSCRIPT_VALIDATION] Time matches transcript', {
                            dateTimeString,
                            transcriptTime: transcriptTime.hour,
                            aiTimeLocal: aiHourLocal,
                        });
                    }
                }
            }
        }
        catch (error) {
            Logger.warn('[TRANSCRIPT_VALIDATION] Error using transcript, falling back to regular correction', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        // Fallback to regular correction
        return this.correctAppointmentTime(dateTimeString);
    }
    /**
     * Validate and correct appointment time to ensure it matches user's requested time
     * Detects common AI timezone conversion errors and corrects them
     * Business hours: 8 AM - 7 PM (08:00 - 19:00)
     */
    correctAppointmentTime(dateTimeString) {
        try {
            // Parse the datetime
            const date = new Date(dateTimeString);
            if (isNaN(date.getTime())) {
                Logger.warn('[TIME_VALIDATION] Invalid date format, using as-is', { dateTimeString });
                return dateTimeString;
            }
            const hour = date.getHours();
            const minutes = date.getMinutes();
            // Extract timezone from original string
            const timezoneMatch = dateTimeString.match(/([+-]\d{2}:\d{2})$/);
            const timezone = timezoneMatch ? timezoneMatch[1] : '-05:00';
            // Business hours validation: 8 AM - 7 PM (08:00 - 19:00)
            // If hour is outside business hours, it's likely a conversion error
            const isOutsideBusinessHours = hour < 8 || hour >= 20;
            if (isOutsideBusinessHours) {
                Logger.warn('[TIME_VALIDATION] Time outside business hours, attempting correction', {
                    original: dateTimeString,
                    hour,
                    minutes,
                    isBeforeBusinessHours: hour < 8,
                    isAfterBusinessHours: hour >= 20,
                });
                // Try multiple correction strategies
                const correctionStrategies = [
                    { hours: -6, description: '6 hours (common CST/EST error)' },
                    { hours: -12, description: '12 hours (AM/PM confusion)' },
                    { hours: 6, description: '+6 hours (reverse error)' },
                    { hours: 12, description: '+12 hours (reverse AM/PM)' },
                ];
                for (const strategy of correctionStrategies) {
                    const correctedDate = new Date(date.getTime() + strategy.hours * 60 * 60 * 1000);
                    const correctedHour = correctedDate.getHours();
                    // Check if corrected hour is in business hours
                    if (correctedHour >= 8 && correctedHour <= 19) {
                        // Reconstruct datetime string with corrected time
                        const year = correctedDate.getFullYear();
                        const month = String(correctedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(correctedDate.getDate()).padStart(2, '0');
                        const correctedHourStr = String(correctedHour).padStart(2, '0');
                        const correctedMinStr = String(correctedDate.getMinutes()).padStart(2, '0');
                        const correctedSecStr = String(correctedDate.getSeconds()).padStart(2, '0');
                        const corrected = `${year}-${month}-${day}T${correctedHourStr}:${correctedMinStr}:${correctedSecStr}${timezone}`;
                        Logger.info('[TIME_VALIDATION] Corrected appointment time', {
                            original: dateTimeString,
                            corrected,
                            originalHour: hour,
                            correctedHour: correctedHour,
                            strategy: strategy.description,
                            correctionHours: strategy.hours,
                        });
                        return corrected;
                    }
                }
                // If no correction worked, log warning but return original
                Logger.warn('[TIME_VALIDATION] Could not find valid correction, using original', {
                    original: dateTimeString,
                    hour,
                    minutes,
                });
            }
            else {
                // Hour is in business hours, validate it's reasonable
                Logger.debug('[TIME_VALIDATION] Time is within business hours', {
                    dateTimeString,
                    hour,
                    minutes,
                });
            }
            // Return original if already valid or if correction failed
            return dateTimeString;
        }
        catch (error) {
            Logger.warn('[TIME_VALIDATION] Error validating time, using as-is', {
                dateTimeString,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return dateTimeString;
        }
    }
    async sendSms(id, args) {
        try {
            Logger.info('Processing send_sms tool call', { id, args });
            // Determine the webhook URL based on template
            let webhookUrl;
            if (args.template === 'booking' && this.bookingWebhookUrl) {
                webhookUrl = this.bookingWebhookUrl;
            }
            else if (args.template === 'deposit' && this.depositWebhookUrl) {
                webhookUrl = this.depositWebhookUrl;
            }
            else if (this.defaultWebhookUrl) {
                webhookUrl = this.defaultWebhookUrl;
            }
            if (!webhookUrl) {
                const error = `No webhook URL configured for template: ${args.template || 'default'}`;
                Logger.error(error, { id });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // Prepare payload for GHL webhook
            const payload = {
                phone: args.phone,
                firstName: args.firstName,
                template: args.template,
                callId: args.callId,
                body: args.body,
                action: 'send_sms',
                timestamp: new Date().toISOString(),
            };
            const response = await this.httpClient.post(webhookUrl, payload);
            if (response.ok) {
                Logger.info('SMS webhook sent successfully', { id, webhookUrl });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
                Logger.error(error, { id, response: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error in send_sms', { id, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async upsertContact(id, args) {
        try {
            Logger.info('Processing upsert_contact tool call', { id, args });
            if (!this.defaultWebhookUrl) {
                const error = 'No default webhook URL configured for upsert_contact';
                Logger.error(error, { id });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // Prepare payload for GHL webhook
            const payload = {
                phone: args.phone,
                email: args.email,
                firstName: args.firstName,
                lastName: args.lastName,
                name: args.name,
                action: 'upsert_contact',
                timestamp: new Date().toISOString(),
            };
            const response = await this.httpClient.post(this.defaultWebhookUrl, payload);
            if (response.ok) {
                Logger.info('Contact upsert webhook sent successfully', { id });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
                Logger.error(error, { id, response: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error in upsert_contact', { id, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async addTag(id, args) {
        try {
            Logger.info('Processing add_tag tool call', { id, args });
            if (!this.defaultWebhookUrl) {
                const error = 'No default webhook URL configured for add_tag';
                Logger.error(error, { id });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // Prepare payload for GHL webhook
            const payload = {
                phone: args.phone,
                email: args.email,
                tag: args.tag,
                action: 'add_tag',
                timestamp: new Date().toISOString(),
            };
            const response = await this.httpClient.post(this.defaultWebhookUrl, payload);
            if (response.ok) {
                Logger.info('Add tag webhook sent successfully', { id });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
                Logger.error(error, { id, response: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error in add_tag', { id, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async addNote(id, args) {
        try {
            Logger.info('Processing add_note tool call', { id, args });
            if (!this.defaultWebhookUrl) {
                const error = 'No default webhook URL configured for add_note';
                Logger.error(error, { id });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // Prepare payload for GHL webhook
            const payload = {
                phone: args.phone,
                email: args.email,
                note: args.note,
                action: 'add_note',
                timestamp: new Date().toISOString(),
            };
            const response = await this.httpClient.post(this.defaultWebhookUrl, payload);
            if (response.ok) {
                Logger.info('Add note webhook sent successfully', { id });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
                Logger.error(error, { id, response: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error in add_note', { id, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async updateStage(id, args) {
        try {
            Logger.info('Processing update_stage tool call', { id, args });
            if (!this.defaultWebhookUrl) {
                const error = 'No default webhook URL configured for update_stage';
                Logger.error(error, { id });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // Prepare payload for GHL webhook
            const payload = {
                phone: args.phone,
                email: args.email,
                pipelineId: args.pipelineId,
                stageId: args.stageId,
                note: args.note,
                action: 'update_stage',
                timestamp: new Date().toISOString(),
            };
            const response = await this.httpClient.post(this.defaultWebhookUrl, payload);
            if (response.ok) {
                Logger.info('Update stage webhook sent successfully', { id });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
                Logger.error(error, { id, response: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('Error in update_stage', { id, error: errorMessage });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    // New method to add note using GHL API directly with contactId
    async addNoteByContactIdViaAPI(id, contactId, note) {
        try {
            Logger.info('[GHL] Processing add_note_by_contact_id_via_api', {
                id,
                contactId,
                noteLength: note.length
            });
            const ghlApiKey = this.getGHLApiKey();
            if (!ghlApiKey) {
                const error = 'GHL_API_KEY not configured for this client';
                Logger.error('[GHL] ' + error, {
                    id,
                    contactId,
                    assistantId: this.assistantId,
                });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
            // GHL API endpoint for adding notes to contacts
            const apiUrl = `https://services.leadconnectorhq.com/contacts/${contactId}/notes`;
            const payload = {
                body: note,
                userId: 'system', // or you can use a specific user ID
            };
            const response = await this.httpClient.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${ghlApiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            });
            if (response.ok) {
                Logger.info('[GHL] Note added to GHL contact successfully via API', {
                    id,
                    contactId,
                    noteId: response.data?.note?.id
                });
                return {
                    id,
                    ok: true,
                    data: response.data,
                };
            }
            else {
                const error = `GHL API failed: ${response.status} ${response.statusText}`;
                Logger.error('[GHL] ' + error, { id, contactId, responseData: response.data });
                return {
                    id,
                    ok: false,
                    error,
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('[GHL] Error in add_note_by_contact_id_via_api', {
                id,
                contactId,
                error: errorMessage
            });
            return {
                id,
                ok: false,
                error: errorMessage,
            };
        }
    }
    async checkCalendarAvailability(id, args, callId, stateStorage) {
        const calendarId = this.getCalendarId();
        if (!calendarId) {
            const error = 'Calendar ID not configured for this client';
            Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.checkAvailabilityInternal(id, args.dateTime, args.durationMinutes || 30, calendarId, 'appointment', callId, stateStorage);
    }
    async checkCallbackAvailability(id, args, callId, stateStorage) {
        const callbackCalendarId = this.getCallbackCalendarId();
        if (!callbackCalendarId) {
            const error = 'Callback Calendar ID not configured for this client';
            Logger.error('[CALLBACK] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.checkAvailabilityInternal(id, args.dateTime, args.durationMinutes || 15, callbackCalendarId, 'callback', callId, stateStorage);
    }
    /**
     * Shared logic for checking calendar availability (appointment or callback)
     */
    async checkAvailabilityInternal(id, dateTime, durationMinutes, calendarId, calendarType, callId, stateStorage) {
        const logPrefix = calendarType === 'callback' ? '[CALLBACK]' : '[CALENDAR]';
        try {
            Logger.info(`${logPrefix} Processing check_${calendarType}_availability`, { id, dateTime, durationMinutes, calendarId });
            const ghlApiKey = this.getGHLApiKey();
            if (!ghlApiKey) {
                const error = 'GHL_API_KEY not configured for this client';
                Logger.error(`${logPrefix} ${error}`, { id, assistantId: this.assistantId });
                return { id, ok: false, error };
            }
            const correctedDateTime = await this.correctAppointmentTimeWithTranscript(dateTime, callId, stateStorage);
            Logger.info(`${logPrefix} DateTime correction applied`, {
                id, original: dateTime, corrected: correctedDateTime,
                wasCorrected: dateTime !== correctedDateTime,
            });
            const requestedDate = new Date(correctedDateTime);
            if (isNaN(requestedDate.getTime())) {
                const error = 'Invalid dateTime format';
                Logger.error(`${logPrefix} ${error}`, { id, dateTime: correctedDateTime });
                return { id, ok: false, error };
            }
            const endDate = new Date(requestedDate.getTime() + durationMinutes * 60000);
            // Extract local date and timezone offset directly from the ISO string.
            // Do NOT use toISOString() here — that converts to UTC and shifts the date
            // for non-UTC timezones, causing the GHL date-key lookup to miss the day entirely.
            const requestedDateKey = correctedDateTime.split('T')[0];
            const tzMatch = correctedDateTime.match(/([+-]\d{2}:\d{2}|Z)$/);
            const tzOffset = tzMatch ? tzMatch[1] : 'Z';
            // Query the full day in local timezone so GHL date keys align with requestedDateKey
            const startOfDay = new Date(`${requestedDateKey}T00:00:00${tzOffset}`);
            const endOfDay = new Date(`${requestedDateKey}T23:59:59${tzOffset}`);
            const apiUrl = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;
            const timezone = this.assistantId ? ClientConfigManager.getTimezone(this.assistantId) : 'America/Chicago';
            const params = new URLSearchParams({
                startDate: startOfDay.getTime().toString(),
                endDate: endOfDay.getTime().toString(),
                timezone,
            });
            Logger.info(`${logPrefix} Querying GHL Calendar API`, {
                id, calendarId, calendarType,
                requestedTime: requestedDate.toISOString(),
                queryRange: `${startOfDay.toISOString()} to ${endOfDay.toISOString()}`,
            });
            const response = await this.httpClient.get(`${apiUrl}?${params.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${ghlApiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            });
            if (!response.ok) {
                const errorDetails = response.data ? JSON.stringify(response.data) : 'No error details';
                const error = `GHL Calendar API failed: ${response.status} ${response.statusText}`;
                Logger.error(`${logPrefix} ${error}`, {
                    id, calendarId,
                    apiUrl: `${apiUrl}?${params.toString()}`,
                    requestParams: { startDate: startOfDay.toISOString(), endDate: endOfDay.toISOString() },
                    responseData: response.data,
                    responseStatus: response.status,
                    responseStatusText: response.statusText,
                    fullResponse: JSON.stringify(response.data),
                });
                return { id, ok: false, error: `${error}. Details: ${errorDetails}` };
            }
            Logger.info(`${logPrefix} Full GHL API response`, {
                id, responseData: response.data,
                responseDataKeys: response.data ? Object.keys(response.data) : [],
                responseDataType: typeof response.data,
            });
            // GHL returns slots organized by date: { "2025-12-23": { "slots": [...] } }
            const dateSlots = requestedDateKey && response.data ? response.data[requestedDateKey] : null;
            const freeSlots = dateSlots?.slots || [];
            Logger.info(`${logPrefix} Free slots from GHL`, {
                id, requestedDateKey,
                freeSlotsCount: freeSlots.length, freeSlots,
                requestedDate: requestedDate.toISOString(),
                requestedDateTimestamp: requestedDate.getTime(),
                endDate: endDate.toISOString(),
                endDateTimestamp: endDate.getTime(),
            });
            // Compare local clock time (HH:MM) extracted directly from the ISO strings,
            // NOT UTC timestamps. The AI sometimes sends the right clock time but with
            // the wrong UTC offset (e.g. -04:00 vs -05:00), which shifts the UTC value
            // by 1 hour even though the intended time is correct. Comparing HH:MM
            // makes the check offset-agnostic and matches what the user actually said.
            const requestedHHMM = correctedDateTime.substring(11, 16);
            const isAvailable = freeSlots.some((slotTime) => {
                const slotHHMM = slotTime.substring(11, 16);
                const matches = requestedHHMM === slotHHMM;
                Logger.debug(`${logPrefix} Comparing slot`, {
                    slotTime, slotHHMM,
                    requestedHHMM,
                    matches,
                });
                return matches;
            });
            Logger.info(`${logPrefix} Availability check completed`, {
                id, requestedTime: requestedDate.toISOString(),
                isAvailable, freeSlotsCount: freeSlots.length, calendarType,
            });
            return {
                id,
                ok: true,
                data: {
                    available: isAvailable,
                    requestedTime: requestedDate.toISOString(),
                    duration: durationMinutes,
                    calendarType,
                    freeSlots,
                    message: isAvailable
                        ? `The requested ${calendarType} time slot is available`
                        : freeSlots.length > 0
                            ? `The requested ${calendarType} time slot is not available. Available slots for ${requestedDateKey}: ${freeSlots.join(', ')}`
                            : `The requested ${calendarType} time slot is not available and there are no open slots on ${requestedDateKey}. Please check a different date.`,
                },
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error(`${logPrefix} Error in check_${calendarType}_availability`, { id, error: errorMessage });
            return { id, ok: false, error: errorMessage };
        }
    }
    async scheduleAppointment(id, args, ghlMetadata, callId, stateStorage) {
        const calendarId = this.getCalendarId();
        if (!calendarId) {
            const error = 'Calendar ID not configured for this client';
            Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.scheduleEventInternal(id, args, calendarId, 'appointment', ghlMetadata, callId, stateStorage);
    }
    async scheduleCallback(id, args, ghlMetadata, callId, stateStorage) {
        const callbackCalendarId = this.getCallbackCalendarId();
        if (!callbackCalendarId) {
            const error = 'Callback Calendar ID not configured for this client';
            Logger.error('[CALLBACK] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.scheduleEventInternal(id, args, callbackCalendarId, 'callback', ghlMetadata, callId, stateStorage);
    }
    async checkGabrielAvailability(id, args, callId, stateStorage) {
        const gabrielCalendarId = this.getGabrielCalendarId();
        if (!gabrielCalendarId) {
            const error = 'Gabriel Calendar ID not configured for this client';
            Logger.error('[GABRIEL] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.checkAvailabilityInternal(id, args.dateTime, args.durationMinutes || 30, gabrielCalendarId, 'appointment', callId, stateStorage);
    }
    async scheduleGabriel(id, args, ghlMetadata, callId, stateStorage) {
        const gabrielCalendarId = this.getGabrielCalendarId();
        if (!gabrielCalendarId) {
            const error = 'Gabriel Calendar ID not configured for this client';
            Logger.error('[GABRIEL] ' + error, { id, assistantId: this.assistantId });
            return { id, ok: false, error };
        }
        return this.scheduleEventInternal(id, args, gabrielCalendarId, 'appointment', ghlMetadata, callId, stateStorage);
    }
    /**
     * Shared logic for scheduling events in GHL (appointment or callback)
     */
    async scheduleEventInternal(id, args, calendarId, calendarType, ghlMetadata, callId, stateStorage) {
        const logPrefix = calendarType === 'callback' ? '[CALLBACK]' : '[CALENDAR]';
        try {
            Logger.info(`${logPrefix} Processing schedule_${calendarType}`, {
                id, args, calendarId, calendarType,
                hasGhlMetadata: !!ghlMetadata,
                ghlMetadataKeys: ghlMetadata ? Object.keys(ghlMetadata) : [],
                ghlMetadataContact: ghlMetadata?.contact ? {
                    hasPhone: !!ghlMetadata.contact.phone,
                    hasPhoneNumber: !!ghlMetadata.contact.phoneNumber,
                    phone: ghlMetadata.contact.phone,
                    phoneNumber: ghlMetadata.contact.phoneNumber,
                    firstName: ghlMetadata.contact.firstName,
                    lastName: ghlMetadata.contact.lastName,
                    allKeys: Object.keys(ghlMetadata.contact),
                } : null,
                fullGhlMetadata: JSON.stringify(ghlMetadata).substring(0, 500),
            });
            const ghlApiKey = this.getGHLApiKey();
            if (!ghlApiKey) {
                const error = 'GHL_API_KEY not configured for this client';
                Logger.error(`${logPrefix} ${error}`, { id, assistantId: this.assistantId });
                return { id, ok: false, error };
            }
            // Try to get locationId (priority: config > calendar API)
            let locationId;
            if (this.assistantId) {
                locationId = ClientConfigManager.getLocationId(this.assistantId);
                if (locationId) {
                    Logger.info(`${logPrefix} Using locationId from config`, { id, calendarId, locationId });
                }
            }
            if (!locationId) {
                try {
                    const calendarResponse = await this.httpClient.get(`https://services.leadconnectorhq.com/calendars/${calendarId}`, {
                        headers: {
                            'Authorization': `Bearer ${ghlApiKey}`,
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                        },
                    });
                    if (calendarResponse.ok) {
                        const calendarData = calendarResponse.data?.calendar || calendarResponse.data;
                        locationId = calendarData?.locationId || calendarResponse.data?.locationId || calendarData?.location?.id || calendarResponse.data?.location?.id;
                        Logger.info(`${logPrefix} Retrieved locationId from calendar`, {
                            id, calendarId, locationId,
                            calendarDataKeys: calendarResponse.data ? Object.keys(calendarResponse.data) : [],
                            calendarKeys: calendarData ? Object.keys(calendarData) : [],
                            hasLocationId: !!calendarData?.locationId,
                            hasLocation: !!calendarData?.location,
                            locationKeys: calendarData?.location ? Object.keys(calendarData.location) : [],
                            fullCalendarData: JSON.stringify(calendarResponse.data).substring(0, 500),
                        });
                    }
                    else {
                        Logger.warn(`${logPrefix} Could not retrieve calendar info for locationId`, {
                            id, calendarId, status: calendarResponse.status,
                        });
                    }
                }
                catch (error) {
                    Logger.warn(`${logPrefix} Error retrieving calendar info for locationId`, {
                        id, calendarId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            const correctedStartTime = await this.correctAppointmentTimeWithTranscript(args.startTime, callId, stateStorage);
            const correctedEndTime = await this.correctAppointmentTimeWithTranscript(args.endTime, callId, stateStorage);
            Logger.info(`${logPrefix} Time correction applied for validation`, {
                id,
                originalStartTime: args.startTime, correctedStartTime,
                originalEndTime: args.endTime, correctedEndTime,
                startTimeWasCorrected: args.startTime !== correctedStartTime,
                endTimeWasCorrected: args.endTime !== correctedEndTime,
            });
            const startTime = new Date(correctedStartTime);
            const endTime = new Date(correctedEndTime);
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                const error = 'Invalid date format for startTime or endTime';
                Logger.error(`${logPrefix} ${error}`, { id, startTime: correctedStartTime, endTime: correctedEndTime });
                return { id, ok: false, error };
            }
            if (endTime <= startTime) {
                const error = 'endTime must be after startTime';
                Logger.error(`${logPrefix} ${error}`, { id, args });
                return { id, ok: false, error };
            }
            // Resolve contact details from multiple sources
            let contactPhone = '';
            let contactFirstName = '';
            let contactLastName = '';
            if (args.phone) {
                contactPhone = args.phone;
                Logger.info(`${logPrefix} Using phone from args`, {
                    id, phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
                });
            }
            if (!contactPhone && ghlMetadata?.contact) {
                Logger.info(`${logPrefix} Using contact details from GHL metadata`, { id, hasContact: !!ghlMetadata.contact });
                contactPhone = ghlMetadata.contact.phone || ghlMetadata.contact.phoneNumber || '';
                contactFirstName = ghlMetadata.contact.firstName || '';
                contactLastName = ghlMetadata.contact.lastName || '';
                Logger.info(`${logPrefix} Contact details from metadata`, {
                    id, firstName: contactFirstName, lastName: contactLastName,
                    phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
                });
            }
            if (!contactFirstName || !contactLastName) {
                const nameParts = args.name.trim().split(/\s+/);
                if (!contactFirstName) {
                    contactFirstName = nameParts[0] || args.name;
                }
                if (!contactLastName) {
                    contactLastName = nameParts.slice(1).join(' ') || '';
                    if (!contactLastName && contactFirstName) {
                        contactLastName = contactFirstName;
                    }
                }
            }
            if (contactPhone) {
                contactPhone = contactPhone.replace(/\s+/g, '').trim();
            }
            if (!contactPhone && args.contactId) {
                Logger.info(`${logPrefix} Attempting to fetch phone from API`, { id, contactId: args.contactId });
                try {
                    const contactResponse = await this.httpClient.get(`https://services.leadconnectorhq.com/contacts/${args.contactId}`, {
                        headers: {
                            'Authorization': `Bearer ${ghlApiKey}`,
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                        },
                    });
                    if (contactResponse.ok) {
                        const contact = contactResponse.data?.contact || contactResponse.data;
                        contactPhone = contact.phone || contact.phoneNumber || '';
                        if (contactPhone) {
                            contactPhone = contactPhone.replace(/\s+/g, '').trim();
                        }
                        Logger.info(`${logPrefix} Phone retrieved from API`, {
                            id, contactId: args.contactId,
                            phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
                        });
                    }
                    else {
                        Logger.warn(`${logPrefix} Could not fetch phone from API`, {
                            id, contactId: args.contactId, status: contactResponse.status, statusText: contactResponse.statusText,
                        });
                    }
                }
                catch (error) {
                    Logger.warn(`${logPrefix} Error fetching phone from API`, {
                        id, contactId: args.contactId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (!contactPhone) {
                const error = 'Phone number is required but could not be retrieved from contact metadata or API. Please ensure the contact has a phone number in GHL or that the phone is included in the webhook metadata.';
                Logger.error(`${logPrefix} ${error}`, {
                    id, contactId: args.contactId,
                    hasGhlMetadata: !!ghlMetadata,
                    hasGhlContact: !!ghlMetadata?.contact,
                    ghlContactKeys: ghlMetadata?.contact ? Object.keys(ghlMetadata.contact) : [],
                });
                return { id, ok: false, error };
            }
            const apiUrl = `https://services.leadconnectorhq.com/calendars/events/appointments`;
            let selectedSlot = correctedStartTime;
            if (!selectedSlot.includes('-05:00') && !selectedSlot.includes('-04:00') && !selectedSlot.includes('-06:00')) {
                const date = new Date(correctedStartTime);
                selectedSlot = date.toISOString().replace('Z', '-05:00');
            }
            let normalizedPhone = contactPhone.replace(/[\s\-\(\)\.]/g, '').trim();
            if (!normalizedPhone.startsWith('+')) {
                if (/^\d{10}$/.test(normalizedPhone)) {
                    normalizedPhone = '+1' + normalizedPhone;
                }
                else if (/^3\d{9}$/.test(normalizedPhone)) {
                    normalizedPhone = '+57' + normalizedPhone;
                }
                else if (/^\d+$/.test(normalizedPhone)) {
                    Logger.warn(`${logPrefix} Phone number missing country code, using as-is`, { id, phone: normalizedPhone });
                }
            }
            if (!normalizedPhone.startsWith('+')) {
                Logger.warn(`${logPrefix} Phone number not in E.164 format, adding +`, {
                    id, originalPhone: contactPhone, normalizedPhone,
                });
                normalizedPhone = '+' + normalizedPhone;
            }
            // Resolve contactId from multiple sources
            let contactIdToUse = args.contactId;
            if (!contactIdToUse && ghlMetadata) {
                contactIdToUse = ghlMetadata.contactId || ghlMetadata.contact?.id;
                if (contactIdToUse) {
                    Logger.info(`${logPrefix} Using contactId from GHL metadata`, { id, contactId: contactIdToUse });
                }
            }
            if (!contactIdToUse && normalizedPhone) {
                try {
                    Logger.info(`${logPrefix} Searching for existing contact by phone`, {
                        id, phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                    });
                    let searchResponse = await this.httpClient.get(`https://services.leadconnectorhq.com/contacts/search?phone=${encodeURIComponent(normalizedPhone)}`, {
                        headers: {
                            'Authorization': `Bearer ${ghlApiKey}`,
                            'Content-Type': 'application/json',
                            'Version': '2021-07-28',
                        },
                    });
                    if (!searchResponse.ok && normalizedPhone.startsWith('+')) {
                        const phoneWithoutPlus = normalizedPhone.substring(1);
                        searchResponse = await this.httpClient.get(`https://services.leadconnectorhq.com/contacts/search?phone=${encodeURIComponent(phoneWithoutPlus)}`, {
                            headers: {
                                'Authorization': `Bearer ${ghlApiKey}`,
                                'Content-Type': 'application/json',
                                'Version': '2021-07-28',
                            },
                        });
                    }
                    if (searchResponse.ok) {
                        const contacts = searchResponse.data?.contacts || searchResponse.data?.data?.contacts || [];
                        if (contacts.length > 0) {
                            contactIdToUse = contacts[0].id;
                            Logger.info(`${logPrefix} Found existing contact by phone`, {
                                id, contactId: contactIdToUse,
                                phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                            });
                        }
                        else {
                            Logger.warn(`${logPrefix} No contacts found by phone search`, {
                                id, phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                                responseData: searchResponse.data,
                            });
                        }
                    }
                    else {
                        Logger.warn(`${logPrefix} Contact search failed`, {
                            id, phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                            status: searchResponse.status, statusText: searchResponse.statusText,
                        });
                    }
                }
                catch (error) {
                    Logger.warn(`${logPrefix} Error searching for contact`, {
                        id, error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
            if (!contactIdToUse && normalizedPhone) {
                const error = `Contact ID is required but could not be found. The contact should exist in GHL (phone: ${normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing'}). Please ensure the contact exists or provide contactId in the arguments.`;
                Logger.error(`${logPrefix} ${error}`, {
                    id, phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                    hasGhlMetadata: !!ghlMetadata,
                    ghlMetadataContactId: ghlMetadata?.contactId || ghlMetadata?.contact?.id,
                });
                return { id, ok: false, error };
            }
            if (!contactIdToUse) {
                const error = `Contact ID is required to schedule ${calendarType}. Contact should exist in GHL but could not be found.`;
                Logger.error(`${logPrefix} ${error}`, {
                    id, phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                });
                return { id, ok: false, error };
            }
            const payload = {
                calendarId,
                contactId: contactIdToUse,
                selectedSlot,
                selectedTimezone: 'America/New_York',
                notes: args.notes || '',
            };
            Logger.info(`${logPrefix} Using contactId in payload`, {
                id, contactId: contactIdToUse,
                payload: { ...payload, contactId: contactIdToUse },
            });
            if (locationId) {
                payload.locationId = locationId;
                Logger.info(`${logPrefix} Added locationId to payload`, { id, locationId, payloadWithLocationId: payload });
            }
            else {
                Logger.warn(`${logPrefix} locationId not available, payload will not include it`, { id, calendarId });
            }
            Logger.info(`${logPrefix} Creating ${calendarType} in GHL`, {
                id, calendarId, calendarType,
                contactId: args.contactId || 'not provided',
                selectedSlot,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                firstName: contactFirstName,
                lastName: contactLastName,
                phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
                payload,
            });
            const response = await this.httpClient.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${ghlApiKey}`,
                    'Content-Type': 'application/json',
                    'Version': '2021-07-28',
                },
            });
            if (response.ok) {
                Logger.info(`${logPrefix} ${calendarType} created successfully`, {
                    id, appointmentId: response.data?.id,
                    contactId: args.contactId || 'not provided',
                    responseData: response.data,
                });
                return {
                    id,
                    ok: true,
                    data: {
                        appointmentId: response.data?.id,
                        calendarId,
                        calendarType,
                        contactId: args.contactId || undefined,
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        message: `${calendarType === 'callback' ? 'Callback' : 'Appointment'} scheduled successfully`,
                    },
                };
            }
            else {
                const errorDetails = response.data ? JSON.stringify(response.data) : 'No error details';
                const error = `GHL Calendar API failed: ${response.status} ${response.statusText}`;
                Logger.error(`${logPrefix} ${error}`, {
                    id, calendarId,
                    contactId: args.contactId || 'not provided',
                    apiUrl, payload,
                    responseData: response.data,
                    responseStatus: response.status,
                    responseStatusText: response.statusText,
                    fullResponse: JSON.stringify(response.data),
                });
                return { id, ok: false, error: `${error}. Details: ${errorDetails}` };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error(`${logPrefix} Error in schedule_${calendarType}`, { id, error: errorMessage });
            return { id, ok: false, error: errorMessage };
        }
    }
}
