import { HttpClient } from './utils/http.js';
import { Logger } from './utils/logger.js';
import { ClientConfigManager } from './utils/client-config.js';
import {
  SendSmsArgs,
  UpsertContactArgs,
  AddTagArgs,
  AddNoteArgs,
  UpdateStageArgs,
  CheckCalendarAvailabilityArgs,
  ScheduleAppointmentArgs,
  RescheduleAppointmentArgs,
  ToolResult,
} from './schemas.js';

export class GHLConnector {
  private httpClient: HttpClient;
  private readonly defaultWebhookUrl: string | undefined;
  private readonly bookingWebhookUrl: string | undefined;
  private readonly depositWebhookUrl: string | undefined;
  private assistantId: string | null = null;

  constructor(assistantId?: string) {
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
  setAssistantId(assistantId: string): void {
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
  private getGHLApiKey(): string {
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
   * Lookup a GHL contact by phone number.
   * Returns a ghlMetadata-shaped object or null if not found.
   */
  async lookupContactByPhone(phone: string): Promise<{ contactId: string; contact: any } | null> {
    const ghlApiKey = this.getGHLApiKey();
    if (!ghlApiKey) {
      Logger.warn('[GHL_CONNECTOR] Cannot lookup contact - no API key');
      return null;
    }

    const trySearch = async (phoneParam: string) => {
      const response = await this.httpClient.get(
        `https://services.leadconnectorhq.com/contacts/search?phone=${encodeURIComponent(phoneParam)}`,
        {
          headers: {
            'Authorization': `Bearer ${ghlApiKey}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
        }
      );
      if (response.ok) {
        return response.data?.contacts || response.data?.data?.contacts || [];
      }
      return [];
    };

    try {
      let contacts = await trySearch(phone);
      if (contacts.length === 0 && phone.startsWith('+')) {
        contacts = await trySearch(phone.substring(1));
      }

      if (contacts.length === 0) {
        Logger.warn('[GHL_CONNECTOR] No contact found by phone', { phone: '***' + phone.slice(-4) });
        return null;
      }

      const contact = contacts[0];
      Logger.info('[GHL_CONNECTOR] Contact found by phone lookup', {
        contactId: contact.id,
        phone: '***' + phone.slice(-4),
      });

      return {
        contactId: contact.id,
        contact: {
          id: contact.id,
          firstName: contact.firstName || '',
          lastName: contact.lastName || '',
          name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          email: contact.email || '',
          phone: contact.phone || contact.phoneNumber || phone,
          phoneNumber: contact.phoneNumber || contact.phone || phone,
        },
      };
    } catch (error) {
      Logger.error('[GHL_CONNECTOR] Phone lookup failed', {
        phone: '***' + phone.slice(-4),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the Calendar ID based on Assistant ID and optional calendar type.
   * - 'main' (default): primary client calendar
   * - 'gabriel': DDP secondary calendar (collections under $40K)
   * - 'callback': callback/recall calendar
   */
  private getCalendarId(calendarType: 'main' | 'gabriel' | 'callback' | 'backneck' = 'main'): string | null {
    if (!this.assistantId) {
      Logger.warn('[GHL_CONNECTOR] No assistantId set on connector');
      return null;
    }

    let calendarId: string | undefined;
    switch (calendarType) {
      case 'gabriel':
        calendarId = ClientConfigManager.getGabrielCalendarId(this.assistantId);
        break;
      case 'callback':
        calendarId = ClientConfigManager.getCallbackCalendarId(this.assistantId);
        break;
      case 'backneck':
        calendarId = ClientConfigManager.getBackNeckCalendarId(this.assistantId);
        break;
      default:
        calendarId = ClientConfigManager.getCalendarId(this.assistantId);
    }

    if (calendarId) {
      Logger.info('[GHL_CONNECTOR] Using calendar ID', {
        assistantId: this.assistantId,
        clientName: ClientConfigManager.getClientName(this.assistantId),
        calendarType,
        calendarId,
      });
      return calendarId;
    }

    Logger.warn('[GHL_CONNECTOR] No calendar ID found for assistant', {
      assistantId: this.assistantId,
      calendarType,
    });
    return null;
  }

  async sendSms(id: string, args: SendSmsArgs): Promise<ToolResult> {
    try {
      Logger.info('Processing send_sms tool call', { id, args });

      // Determine the webhook URL based on template
      let webhookUrl: string | undefined;
      
      if (args.template === 'booking' && this.bookingWebhookUrl) {
        webhookUrl = this.bookingWebhookUrl;
      } else if (args.template === 'deposit' && this.depositWebhookUrl) {
        webhookUrl = this.depositWebhookUrl;
      } else if (this.defaultWebhookUrl) {
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
      } else {
        const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
        Logger.error(error, { id, response: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Error in send_sms', { id, error: errorMessage });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  async upsertContact(id: string, args: UpsertContactArgs): Promise<ToolResult> {
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
      } else {
        const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
        Logger.error(error, { id, response: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Error in upsert_contact', { id, error: errorMessage });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  async addTag(id: string, args: AddTagArgs): Promise<ToolResult> {
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
      } else {
        const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
        Logger.error(error, { id, response: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Error in add_tag', { id, error: errorMessage });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  async addNote(id: string, args: AddNoteArgs): Promise<ToolResult> {
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
      } else {
        const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
        Logger.error(error, { id, response: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Error in add_note', { id, error: errorMessage });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  async updateStage(id: string, args: UpdateStageArgs): Promise<ToolResult> {
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
      } else {
        const error = `GHL webhook failed: ${response.status} ${response.statusText}`;
        Logger.error(error, { id, response: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
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
  async addNoteByContactIdViaAPI(id: string, contactId: string, note: string): Promise<ToolResult> {
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
      } else {
        const error = `GHL API failed: ${response.status} ${response.statusText}`;
        Logger.error('[GHL] ' + error, { id, contactId, responseData: response.data });
        return {
          id,
          ok: false,
          error,
        };
      }
    } catch (error) {
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

  async checkCalendarAvailability(id: string, args: CheckCalendarAvailabilityArgs, _callId?: string, _stateStorage?: any, calendarType: 'main' | 'gabriel' | 'callback' | 'backneck' = 'main'): Promise<ToolResult> {
    try {
      Logger.info('[CALENDAR] Processing check_calendar_availability', { id, args, calendarType });

      const ghlApiKey = this.getGHLApiKey();
      if (!ghlApiKey) {
        const error = 'GHL_API_KEY not configured for this client';
        Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
        return {
          id,
          ok: false,
          error,
        };
      }

      const calendarId = this.getCalendarId(calendarType);
      if (!calendarId) {
        const error = 'Calendar ID not configured for this client';
        Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
        return {
          id,
          ok: false,
          error,
        };
      }

      // Trust the AI's dateTime as-is — transcript correction was overwriting
      // legitimate slot queries (e.g. checking 3 PM when user said "11 AM")
      const correctedDateTime = args.dateTime;

      Logger.info('[CALENDAR] Using dateTime as provided by AI', {
        id,
        dateTime: correctedDateTime,
      });
      
      // Parse the requested dateTime
      const requestedDate = new Date(correctedDateTime);
      if (isNaN(requestedDate.getTime())) {
        const error = 'Invalid dateTime format';
        Logger.error('[CALENDAR] ' + error, { id, dateTime: correctedDateTime });
        return {
          id,
          ok: false,
          error,
        };
      }

      // Calculate end time based on duration
      const endDate = new Date(requestedDate.getTime() + (args.durationMinutes || 30) * 60000);

      // Query GHL Calendar API for free slots over a wide window so that, when
      // the requested day has nothing open, we can surface the next real slots
      // to the AI instead of forcing it to blindly guess another day.
      const startDate = new Date(requestedDate.getTime() - 24 * 60 * 60000); // 24h before
      const endDateRange = new Date(requestedDate.getTime() + 14 * 24 * 60 * 60000); // 14 days after

      const apiUrl = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;
      const params = new URLSearchParams({
        startDate: startDate.getTime().toString(),
        endDate: endDateRange.getTime().toString(),
      });

      Logger.info('[CALENDAR] Querying GHL Calendar API', {
        id,
        calendarId,
        requestedTime: requestedDate.toISOString(),
        queryRange: `${startDate.toISOString()} to ${endDateRange.toISOString()}`,
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
        Logger.error('[CALENDAR] ' + error, { 
          id, 
          calendarId,
          apiUrl: `${apiUrl}?${params.toString()}`,
          requestParams: {
            startDate: startDate.toISOString(),
            endDate: endDateRange.toISOString(),
          },
          responseData: response.data,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          fullResponse: JSON.stringify(response.data),
        });
        return {
          id,
          ok: false,
          error: `${error}. Details: ${errorDetails}`,
        };
      }

      // Log the full response from GHL to understand the structure
      Logger.info('[CALENDAR] Full GHL API response', {
        id,
        responseData: response.data,
        responseDataKeys: response.data ? Object.keys(response.data) : [],
        responseDataType: typeof response.data,
      });

      // GHL groups slots by date in the calendar's own timezone:
      //   { "2026-05-14": { "slots": ["2026-05-14T10:00:00-04:00", ...] }, ... }
      // To avoid UTC date-key drift (e.g. 10pm EDT = 2am UTC next day) we
      // flatten every date key in the response into one list and then filter
      // by the offset embedded in each slot's ISO string.
      const responseData = response.data && typeof response.data === 'object' ? response.data as Record<string, any> : {};
      const allSlots: string[] = [];
      const dateKeysWithSlots: string[] = [];
      for (const [key, value] of Object.entries(responseData)) {
        if (value && typeof value === 'object' && Array.isArray((value as any).slots)) {
          const slots = (value as any).slots as string[];
          if (slots.length > 0) {
            dateKeysWithSlots.push(key);
            allSlots.push(...slots);
          }
        }
      }

      // Extract the local date portion (YYYY-MM-DD) using the offset embedded
      // in each ISO string, so we compare apples to apples regardless of TZ.
      const localDateOf = (iso: string): string => iso.slice(0, 10);
      const requestedLocalDate = localDateOf(args.dateTime);

      const slotsForRequestedDay = allSlots
        .filter(s => localDateOf(s) === requestedLocalDate)
        .sort();

      Logger.info('[CALENDAR] Free slots from GHL', {
        id,
        requestedLocalDate,
        dateKeysWithSlots,
        totalSlotsReturned: allSlots.length,
        slotsForRequestedDayCount: slotsForRequestedDay.length,
        slotsForRequestedDay,
        requestedDate: requestedDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Compare slot start times to the requested time. We accept a match
      // either by exact UTC instant (1-minute tolerance) OR by local wall
      // clock (YYYY-MM-DDTHH:MM). The LLM frequently re-emits a slot with
      // the doctor's local TZ offset (e.g. "-04:00") instead of the calendar's
      // own offset (e.g. "-06:00") — different UTC moments but the same wall
      // clock the doctor heard. Treating wall-clock matches as available keeps
      // the booking flow accurate to what the doctor actually agreed to.
      const wallClockOf = (iso: string): string => iso.slice(0, 16);
      const requestedWallClock = wallClockOf(args.dateTime);
      const isAvailable = slotsForRequestedDay.some((slotTime: string) => {
        if (wallClockOf(slotTime) === requestedWallClock) return true;
        const slotDate = new Date(slotTime);
        const timeDiff = Math.abs(requestedDate.getTime() - slotDate.getTime());
        return timeDiff < 60000;
      });

      // Format slots in a human-friendly way (e.g. "10:00 AM") so the AI can
      // read them directly to the doctor without parsing ISO strings.
      const formatSlot = (iso: string): string => {
        const offsetMatch = iso.match(/([+-]\d{2}:\d{2})$/);
        const offset = offsetMatch ? offsetMatch[1] : '';
        const parts = iso.slice(11, 16).split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${hr12}:${m.toString().padStart(2, '0')} ${ampm}${offset ? ` (${offset})` : ''}`;
      };

      // Format a slot with its weekday + date so the AI can offer it from
      // any day in the search window without having to compute the calendar
      // day itself. The format is offset-agnostic: we shift the UTC instant
      // by the embedded offset and then read fields in UTC, which yields the
      // local wall-clock the slot was published in.
      const formatSlotWithDate = (iso: string): string => {
        const offsetMatch = iso.match(/([+-])(\d{2}):(\d{2})$/);
        if (!offsetMatch) return iso;
        const sign = offsetMatch[1] === '+' ? 1 : -1;
        const oh = parseInt(offsetMatch[2] ?? '0', 10);
        const om = parseInt(offsetMatch[3] ?? '0', 10);
        const offsetMs = sign * (oh * 60 + om) * 60000;
        const shifted = new Date(new Date(iso).getTime() + offsetMs);
        const weekday = shifted.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        const month = shifted.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
        const dayNum = shifted.getUTCDate();
        const h24 = shifted.getUTCHours();
        const m = shifted.getUTCMinutes();
        const hr12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
        const ampm = h24 >= 12 ? 'PM' : 'AM';
        return `${weekday}, ${month} ${dayNum} at ${hr12}:${m.toString().padStart(2, '0')} ${ampm}`;
      };

      const formattedSlotsForDay = slotsForRequestedDay.map(formatSlot);
      const slotsForResponse = slotsForRequestedDay.slice(0, 10);

      // When the requested day has no slots, surface the next real openings
      // from the wider 14-day window so the AI can offer a concrete time
      // instead of guessing another day blindly. Take up to 2 slots per day,
      // max 8 total — enough real options without flooding the prompt.
      const nextAvailableSlots: string[] = [];
      const nextAvailableSlotsFormatted: string[] = [];
      if (slotsForRequestedDay.length === 0) {
        const requestedMs = requestedDate.getTime();
        const upcoming = allSlots
          .filter(s => {
            const d = new Date(s).getTime();
            return !Number.isNaN(d) && d >= requestedMs;
          })
          .sort();
        const perDayCount = new Map<string, number>();
        for (const slot of upcoming) {
          const day = localDateOf(slot);
          const count = perDayCount.get(day) ?? 0;
          if (count >= 2) continue;
          perDayCount.set(day, count + 1);
          nextAvailableSlots.push(slot);
          nextAvailableSlotsFormatted.push(formatSlotWithDate(slot));
          if (nextAvailableSlots.length >= 8) break;
        }
      }

      Logger.info('[CALENDAR] Availability check completed', {
        id,
        requestedTime: requestedDate.toISOString(),
        isAvailable,
        slotsForRequestedDayCount: slotsForRequestedDay.length,
        nextAvailableCount: nextAvailableSlots.length,
      });

      const baseMessage = isAvailable
        ? 'The requested time slot is available.'
        : slotsForRequestedDay.length > 0
          ? `The requested time slot is not available. Other open slots on ${requestedLocalDate}: ${formattedSlotsForDay.slice(0, 10).join(', ')}.`
          : nextAvailableSlots.length > 0
            ? `No open slots on ${requestedLocalDate}. The next available openings are: ${nextAvailableSlotsFormatted.join(', ')}. Offer one of these to the caller — do not invent other days or times.`
            : `No open slots on ${requestedLocalDate} or within the next 14 days. Offer to transfer the caller or schedule a callback.`;

      return {
        id,
        ok: true,
        data: {
          available: isAvailable,
          requestedTime: requestedDate.toISOString(),
          duration: args.durationMinutes || 30,
          message: baseMessage,
          ...(isAvailable
            ? {}
            : {
                availableSlots: slotsForResponse,
                availableSlotsFormatted: formattedSlotsForDay.slice(0, 10),
                ...(nextAvailableSlots.length > 0
                  ? { nextAvailableSlots, nextAvailableSlotsFormatted }
                  : {}),
              }),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('[CALENDAR] Error in check_calendar_availability', { 
        id, 
        error: errorMessage 
      });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  async scheduleAppointment(id: string, args: ScheduleAppointmentArgs, ghlMetadata?: any, _callId?: string, _stateStorage?: any, calendarType: 'main' | 'gabriel' | 'callback' | 'backneck' = 'main'): Promise<ToolResult> {
    try {
      Logger.info('[CALENDAR] Processing schedule_appointment', {
        id,
        args,
        calendarType,
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
        Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
        return {
          id,
          ok: false,
          error,
        };
      }

      const calendarId = this.getCalendarId(calendarType);
      if (!calendarId) {
        const error = 'Calendar ID not configured for this client';
        Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId, calendarType });
        return {
          id,
          ok: false,
          error,
        };
      }

      // Try to get locationId (priority: config > calendar API)
      let locationId: string | undefined;
      
      // First, try to get from config
      if (this.assistantId) {
        locationId = ClientConfigManager.getLocationId(this.assistantId);
        if (locationId) {
          Logger.info('[CALENDAR] Using locationId from config', {
            id,
            calendarId,
            locationId,
          });
        }
      }

      // If not in config, try to get from calendar info
      if (!locationId) {
        try {
          const calendarResponse = await this.httpClient.get(
            `https://services.leadconnectorhq.com/calendars/${calendarId}`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
              },
            }
          );

          if (calendarResponse.ok) {
            // GHL API returns calendar data in different structures:
            // Option 1: { calendar: { locationId: "..." } } - most common
            // Option 2: { locationId: "..." }
            // Option 3: { location: { id: "..." } }
            const calendarData = calendarResponse.data?.calendar || calendarResponse.data;
            locationId = calendarData?.locationId || calendarResponse.data?.locationId || calendarData?.location?.id || calendarResponse.data?.location?.id;
            
            Logger.info('[CALENDAR] Retrieved locationId from calendar', {
              id,
              calendarId,
              locationId,
              calendarDataKeys: calendarResponse.data ? Object.keys(calendarResponse.data) : [],
              calendarKeys: calendarData ? Object.keys(calendarData) : [],
              hasLocationId: !!calendarData?.locationId,
              hasLocation: !!calendarData?.location,
              locationKeys: calendarData?.location ? Object.keys(calendarData.location) : [],
              fullCalendarData: JSON.stringify(calendarResponse.data).substring(0, 500),
            });
          } else {
            Logger.warn('[CALENDAR] Could not retrieve calendar info for locationId', {
              id,
              calendarId,
              status: calendarResponse.status,
            });
          }
        } catch (error) {
          Logger.warn('[CALENDAR] Error retrieving calendar info for locationId', {
            id,
            calendarId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Trust the AI's startTime/endTime as-is — transcript correction was
      // corrupting times by forcing every datetime to match the spoken hour
      const correctedStartTime = args.startTime;
      const correctedEndTime = args.endTime;

      Logger.info('[CALENDAR] Using startTime/endTime as provided by AI', {
        id,
        startTime: correctedStartTime,
        endTime: correctedEndTime,
      });
      
      // Validate date formats (using corrected times)
      const startTime = new Date(correctedStartTime);
      const endTime = new Date(correctedEndTime);

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        const error = 'Invalid date format for startTime or endTime';
        Logger.error('[CALENDAR] ' + error, { id, startTime: correctedStartTime, endTime: correctedEndTime });
        return {
          id,
          ok: false,
          error,
        };
      }

      if (endTime <= startTime) {
        const error = 'endTime must be after startTime';
        Logger.error('[CALENDAR] ' + error, { id, args });
        return {
          id,
          ok: false,
          error,
        };
      }

      // Try to get contact details from multiple sources (priority order):
      // 1. args.phone (passed directly by AI agent)
      // 2. GHL metadata (from webhook)
      // 3. API call (if contactId provided)
      let contactPhone = '';
      let contactFirstName = '';
      let contactLastName = '';

      // First priority: phone from args (passed directly by AI agent)
      if (args.phone) {
        contactPhone = args.phone;
        Logger.info('[CALENDAR] Using phone from args', {
          id,
          phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
        });
      }

      // Second priority: GHL metadata (from webhook)
      if (!contactPhone && ghlMetadata?.contact) {
        Logger.info('[CALENDAR] Using contact details from GHL metadata', {
          id,
          hasContact: !!ghlMetadata.contact,
        });
        
        contactPhone = ghlMetadata.contact.phone || ghlMetadata.contact.phoneNumber || '';
        contactFirstName = ghlMetadata.contact.firstName || '';
        contactLastName = ghlMetadata.contact.lastName || '';

        Logger.info('[CALENDAR] Contact details from metadata', {
          id,
          firstName: contactFirstName,
          lastName: contactLastName,
          phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
        });
      }

      // Parse name from args.name (only if we don't have it from metadata)
      if (!contactFirstName || !contactLastName) {
        const nameParts = args.name.trim().split(/\s+/);
        if (!contactFirstName) {
          contactFirstName = nameParts[0] || args.name;
        }
        if (!contactLastName) {
          contactLastName = nameParts.slice(1).join(' ') || '';
          // GHL might require lastName, use firstName if empty
          if (!contactLastName && contactFirstName) {
            contactLastName = contactFirstName;
          }
        }
      }

      // Normalize phone (remove spaces and special characters, keep + and numbers)
      if (contactPhone) {
        contactPhone = contactPhone.replace(/\s+/g, '').trim();
      }

      // Third priority: Only try API if we're missing phone AND have contactId
      if (!contactPhone && args.contactId) {
        Logger.info('[CALENDAR] Attempting to fetch phone from API', {
          id,
          contactId: args.contactId,
        });

        try {
          const contactResponse = await this.httpClient.get(
            `https://services.leadconnectorhq.com/contacts/${args.contactId}`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
              },
            }
          );

          if (contactResponse.ok) {
            const contact = contactResponse.data?.contact || contactResponse.data;
            contactPhone = contact.phone || contact.phoneNumber || '';
            
            // Normalize phone
            if (contactPhone) {
              contactPhone = contactPhone.replace(/\s+/g, '').trim();
            }

            Logger.info('[CALENDAR] Phone retrieved from API', {
              id,
              contactId: args.contactId,
              phone: contactPhone ? '***' + contactPhone.slice(-4) : 'missing',
            });
          } else {
            Logger.warn('[CALENDAR] Could not fetch phone from API', {
              id,
              contactId: args.contactId,
              status: contactResponse.status,
              statusText: contactResponse.statusText,
            });
          }
        } catch (error) {
          Logger.warn('[CALENDAR] Error fetching phone from API', {
            id,
            contactId: args.contactId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Phone is required by GHL API
      if (!contactPhone) {
        const error = 'Phone number is required but could not be retrieved from contact metadata or API. Please ensure the contact has a phone number in GHL or that the phone is included in the webhook metadata.';
        Logger.error('[CALENDAR] ' + error, { 
          id, 
          contactId: args.contactId,
          hasGhlMetadata: !!ghlMetadata,
          hasGhlContact: !!ghlMetadata?.contact,
          ghlContactKeys: ghlMetadata?.contact ? Object.keys(ghlMetadata.contact) : [],
        });
        return {
          id,
          ok: false,
          error,
        };
      }

      // Create appointment in GHL Calendar using the correct endpoint
      // GHL requires: /calendars/events/appointments with firstName, lastName, phone, selectedSlot
      const apiUrl = `https://services.leadconnectorhq.com/calendars/events/appointments`;
      
      // GHL expects selectedSlot as ISO string with the calendar's own timezone
      // offset. The LLM frequently re-emits a slot we returned in (e.g.) "-06:00"
      // with the doctor's local offset (e.g. "-04:00") because it normalizes to
      // the spoken timezone. That mismatch makes GHL reject the booking with
      // "the slot you have selected is no longer available". Reconcile by
      // querying free-slots for the requested day and matching on the local
      // wall-clock (date + HH:MM) — that recovers the canonical ISO from GHL.
      let selectedSlot = correctedStartTime;
      try {
        const dayStartMs = startTime.getTime() - 24 * 60 * 60000;
        const dayEndMs = startTime.getTime() + 24 * 60 * 60000;
        const slotsResp = await this.httpClient.get(
          `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots?startDate=${dayStartMs}&endDate=${dayEndMs}`,
          {
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
          }
        );
        if (slotsResp.ok && slotsResp.data && typeof slotsResp.data === 'object') {
          const flatSlots: string[] = [];
          for (const v of Object.values(slotsResp.data as Record<string, any>)) {
            if (v && Array.isArray((v as any).slots)) {
              flatSlots.push(...((v as any).slots as string[]));
            }
          }
          const requestedWallClock = correctedStartTime.slice(0, 16);
          const match = flatSlots.find(s => s.slice(0, 16) === requestedWallClock);
          if (match) {
            Logger.info('[CALENDAR] Reconciled slot via wall-clock match', {
              id,
              requested: correctedStartTime,
              resolved: match,
            });
            selectedSlot = match;
          } else {
            Logger.warn('[CALENDAR] No wall-clock match; will pass AI value as-is', {
              id,
              requested: correctedStartTime,
              flatSlotsCount: flatSlots.length,
              sampleSlots: flatSlots.slice(0, 5),
            });
          }
        }
      } catch (err) {
        Logger.warn('[CALENDAR] Slot reconciliation failed; using AI value as-is', {
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Fallback: if the slot still has no offset at all, assume EST.
      if (!/[+-]\d{2}:\d{2}$/.test(selectedSlot)) {
        const date = new Date(selectedSlot);
        selectedSlot = date.toISOString().replace('Z', '-05:00');
      }

      // Normalize phone number - GHL requires E.164 format (with + and country code)
      let normalizedPhone = contactPhone;
      
      // Remove all spaces and special characters except +
      normalizedPhone = normalizedPhone.replace(/[\s\-\(\)\.]/g, '').trim();
      
      // If phone doesn't start with +, try to add country code
      if (!normalizedPhone.startsWith('+')) {
        // If it's a US number (10 digits), add +1
        if (/^\d{10}$/.test(normalizedPhone)) {
          normalizedPhone = '+1' + normalizedPhone;
        }
        // If it's a Colombian number (10 digits starting with 3), add +57
        else if (/^3\d{9}$/.test(normalizedPhone)) {
          normalizedPhone = '+57' + normalizedPhone;
        }
        // Otherwise, assume it needs + prefix (might be missing country code)
        else if (/^\d+$/.test(normalizedPhone)) {
          // Keep as is but log warning - might need country code
          Logger.warn('[CALENDAR] Phone number missing country code, using as-is', {
            id,
            phone: normalizedPhone,
          });
        }
      }
      
      // Ensure phone is in E.164 format (starts with +)
      if (!normalizedPhone.startsWith('+')) {
        Logger.warn('[CALENDAR] Phone number not in E.164 format, adding +', {
          id,
          originalPhone: contactPhone,
          normalizedPhone,
        });
        normalizedPhone = '+' + normalizedPhone;
      }

      // Get contactId - contact always exists if call happened, so we must find it
      let contactIdToUse: string | undefined = args.contactId;
      
      // Priority 1: Try to get contactId from GHL metadata (from webhook)
      if (!contactIdToUse && ghlMetadata) {
        contactIdToUse = ghlMetadata.contactId || ghlMetadata.contact?.id;
        if (contactIdToUse) {
          Logger.info('[CALENDAR] Using contactId from GHL metadata', {
            id,
            contactId: contactIdToUse,
          });
        }
      }
      
      // Priority 2: Search for existing contact by phone (contact always exists)
      if (!contactIdToUse && normalizedPhone) {
        try {
          Logger.info('[CALENDAR] Searching for existing contact by phone', {
            id,
            phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
          });
          
          // Try different search endpoints/formats
          // Option 1: Search by phone with + prefix
          let searchResponse = await this.httpClient.get(
            `https://services.leadconnectorhq.com/contacts/search?phone=${encodeURIComponent(normalizedPhone)}`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
              },
            }
          );
          
          // Option 2: If that fails, try without + prefix
          if (!searchResponse.ok && normalizedPhone.startsWith('+')) {
            const phoneWithoutPlus = normalizedPhone.substring(1);
            searchResponse = await this.httpClient.get(
              `https://services.leadconnectorhq.com/contacts/search?phone=${encodeURIComponent(phoneWithoutPlus)}`,
              {
                headers: {
                  'Authorization': `Bearer ${ghlApiKey}`,
                  'Content-Type': 'application/json',
                  'Version': '2021-07-28',
                },
              }
            );
          }
          
          if (searchResponse.ok) {
            const contacts = searchResponse.data?.contacts || searchResponse.data?.data?.contacts || [];
            if (contacts.length > 0) {
              contactIdToUse = contacts[0].id;
              Logger.info('[CALENDAR] Found existing contact by phone', {
                id,
                contactId: contactIdToUse,
                phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
              });
            } else {
              Logger.warn('[CALENDAR] No contacts found by phone search', {
                id,
                phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
                responseData: searchResponse.data,
              });
            }
          } else {
            Logger.warn('[CALENDAR] Contact search failed', {
              id,
              phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
              status: searchResponse.status,
              statusText: searchResponse.statusText,
            });
          }
        } catch (error) {
          Logger.warn('[CALENDAR] Error searching for contact', {
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      // If we still don't have contactId, we can't proceed - contact must exist
      if (!contactIdToUse && normalizedPhone) {
        const error = `Contact ID is required but could not be found. The contact should exist in GHL (phone: ${normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing'}). Please ensure the contact exists or provide contactId in the arguments.`;
        Logger.error('[CALENDAR] ' + error, { 
          id, 
          phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
          hasGhlMetadata: !!ghlMetadata,
          ghlMetadataContactId: ghlMetadata?.contactId || ghlMetadata?.contact?.id,
        });
        return {
          id,
          ok: false,
          error,
        };
      }
      
      // GHL requires contactId - we should have it by now since contact always exists
      if (!contactIdToUse) {
        const error = 'Contact ID is required to schedule appointment. Contact should exist in GHL but could not be found.';
        Logger.error('[CALENDAR] ' + error, { 
          id,
          phone: normalizedPhone ? '***' + normalizedPhone.slice(-4) : 'missing',
        });
        return {
          id,
          ok: false,
          error,
        };
      }
      
      // If the AI collected an email at scheduling time, persist it on the
      // existing contact ONLY when the contact has no email yet. Best-effort:
      // booking proceeds even if the lookup or update fails.
      if (args.email && contactIdToUse) {
        try {
          const lookupResp = await this.httpClient.get(
            `https://services.leadconnectorhq.com/contacts/${contactIdToUse}`,
            {
              headers: {
                'Authorization': `Bearer ${ghlApiKey}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
              },
            }
          );

          const existingContact = lookupResp.data?.contact || lookupResp.data;
          const existingEmail = (existingContact?.email ?? '').trim();

          if (!lookupResp.ok) {
            Logger.warn('[CALENDAR] Contact lookup before email update failed; skipping update', {
              id,
              contactId: contactIdToUse,
              status: lookupResp.status,
            });
          } else if (existingEmail) {
            Logger.info('[CALENDAR] Contact already has an email; skipping update', {
              id,
              contactId: contactIdToUse,
            });
          } else {
            Logger.info('[CALENDAR] Contact email empty — saving from scheduling args', {
              id,
              contactId: contactIdToUse,
            });
            const updateResp = await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactIdToUse}`,
              {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${ghlApiKey}`,
                  'Content-Type': 'application/json',
                  'Version': '2021-07-28',
                },
                body: JSON.stringify({ email: args.email }),
              }
            );
            if (!updateResp.ok) {
              Logger.warn('[CALENDAR] Email update returned non-OK; continuing with booking', {
                id,
                contactId: contactIdToUse,
                status: updateResp.status,
              });
            }
          }
        } catch (err) {
          Logger.warn('[CALENDAR] Email update flow failed; continuing with booking', {
            id,
            contactId: contactIdToUse,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Use contactId in payload (required by GHL)
      const payload: any = {
        calendarId,
        contactId: contactIdToUse,
        selectedSlot,
        selectedTimezone: 'America/New_York', // EST timezone - could be made configurable
        notes: args.notes || '',
      };
      
      Logger.info('[CALENDAR] Using contactId in payload', {
        id,
        contactId: contactIdToUse,
        payload: { ...payload, contactId: contactIdToUse },
      });

      // Add locationId if available (some GHL endpoints require it)
      if (locationId) {
        payload.locationId = locationId;
        Logger.info('[CALENDAR] Added locationId to payload', {
          id,
          locationId,
          payloadWithLocationId: payload,
        });
      } else {
        Logger.warn('[CALENDAR] locationId not available, payload will not include it', {
          id,
          calendarId,
        });
      }

      Logger.info('[CALENDAR] Creating appointment in GHL', {
        id,
        calendarId,
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
        Logger.info('[CALENDAR] Appointment created successfully', { 
          id, 
          appointmentId: response.data?.id,
          contactId: args.contactId || 'not provided',
          responseData: response.data,
        });
        return {
          id,
          ok: true,
          data: {
            appointmentId: response.data?.id,
            calendarId,
            contactId: args.contactId || undefined,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            message: 'Appointment scheduled successfully',
          },
        };
      } else {
        const errorDetails = response.data ? JSON.stringify(response.data) : 'No error details';
        const error = `GHL Calendar API failed: ${response.status} ${response.statusText}`;
        Logger.error('[CALENDAR] ' + error, { 
          id, 
          calendarId,
          contactId: args.contactId || 'not provided',
          apiUrl,
          payload,
          responseData: response.data,
          responseStatus: response.status,
          responseStatusText: response.statusText,
          fullResponse: JSON.stringify(response.data),
        });
        return {
          id,
          ok: false,
          error: `${error}. Details: ${errorDetails}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('[CALENDAR] Error in schedule_appointment', {
        id,
        error: errorMessage
      });
      return {
        id,
        ok: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Reconcile an AI-provided ISO start time against GHL's canonical free slots.
   *
   * The LLM frequently re-emits a slot we returned (e.g. in "-06:00") using the
   * caller's local offset (e.g. "-04:00") — a different UTC instant but the same
   * wall clock. GHL then rejects it as "no longer available". We recover the
   * canonical ISO by matching on the local wall-clock (YYYY-MM-DDTHH:MM). Falls
   * back to the AI value (with an EST offset if none is present) when no match.
   */
  private async reconcileSlot(id: string, calendarId: string, ghlApiKey: string, requestedStartIso: string): Promise<string> {
    let selectedSlot = requestedStartIso;
    try {
      const startMs = new Date(requestedStartIso).getTime();
      if (!Number.isNaN(startMs)) {
        const dayStartMs = startMs - 24 * 60 * 60000;
        const dayEndMs = startMs + 24 * 60 * 60000;
        const slotsResp = await this.httpClient.get(
          `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots?startDate=${dayStartMs}&endDate=${dayEndMs}`,
          {
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
          }
        );
        if (slotsResp.ok && slotsResp.data && typeof slotsResp.data === 'object') {
          const flatSlots: string[] = [];
          for (const v of Object.values(slotsResp.data as Record<string, any>)) {
            if (v && Array.isArray((v as any).slots)) {
              flatSlots.push(...((v as any).slots as string[]));
            }
          }
          const requestedWallClock = requestedStartIso.slice(0, 16);
          const match = flatSlots.find(s => s.slice(0, 16) === requestedWallClock);
          if (match) {
            Logger.info('[CALENDAR] Reconciled slot via wall-clock match', { id, requested: requestedStartIso, resolved: match });
            selectedSlot = match;
          } else {
            Logger.warn('[CALENDAR] No wall-clock match; using AI value as-is', {
              id,
              requested: requestedStartIso,
              flatSlotsCount: flatSlots.length,
              sampleSlots: flatSlots.slice(0, 5),
            });
          }
        }
      }
    } catch (err) {
      Logger.warn('[CALENDAR] Slot reconciliation failed; using AI value as-is', {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Fallback: if the slot still has no offset at all, assume EST.
    if (!/[+-]\d{2}:\d{2}$/.test(selectedSlot)) {
      const date = new Date(selectedSlot);
      if (!Number.isNaN(date.getTime())) {
        selectedSlot = date.toISOString().replace('Z', '-05:00');
      }
    }
    return selectedSlot;
  }

  /**
   * Reschedule an existing, active appointment to a new time slot.
   *
   * Flow: resolve the contact (from args / metadata / phone search) → find the
   * contact's next active appointment on the target calendar (unless the AI
   * passed an explicit appointmentId) → reconcile the new slot against GHL's
   * free-slots → PUT the event in place so the same appointmentId and history
   * are preserved.
   */
  async rescheduleAppointment(id: string, args: RescheduleAppointmentArgs, ghlMetadata?: any, _callId?: string, _stateStorage?: any, calendarType: 'main' | 'gabriel' | 'callback' | 'backneck' = 'main'): Promise<ToolResult> {
    try {
      Logger.info('[RESCHEDULE] Processing reschedule_appointment', {
        id,
        args: { ...args, phone: args.phone ? '***' + args.phone.slice(-4) : undefined },
        calendarType,
        hasGhlMetadata: !!ghlMetadata,
      });

      const ghlApiKey = this.getGHLApiKey();
      if (!ghlApiKey) {
        const error = 'GHL_API_KEY not configured for this client';
        Logger.error('[RESCHEDULE] ' + error, { id, assistantId: this.assistantId });
        return { id, ok: false, error };
      }

      const calendarId = this.getCalendarId(calendarType);
      if (!calendarId) {
        const error = 'Calendar ID not configured for this client';
        Logger.error('[RESCHEDULE] ' + error, { id, assistantId: this.assistantId, calendarType });
        return { id, ok: false, error };
      }

      // Validate the new time range up front.
      const newStart = new Date(args.newStartTime);
      const newEnd = new Date(args.newEndTime);
      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
        const error = 'Invalid date format for newStartTime or newEndTime';
        Logger.error('[RESCHEDULE] ' + error, { id, newStartTime: args.newStartTime, newEndTime: args.newEndTime });
        return { id, ok: false, error };
      }
      if (newEnd <= newStart) {
        const error = 'newEndTime must be after newStartTime';
        Logger.error('[RESCHEDULE] ' + error, { id, args });
        return { id, ok: false, error };
      }

      // ── Resolve contactId ────────────────────────────────────────────
      // Priority: explicit arg > webhook metadata > phone search.
      let contactId: string | undefined = args.contactId || ghlMetadata?.contactId || ghlMetadata?.contact?.id;

      if (!contactId) {
        const rawPhone = args.phone || ghlMetadata?.contact?.phone || ghlMetadata?.contact?.phoneNumber;
        if (rawPhone) {
          const found = await this.lookupContactByPhone(rawPhone.replace(/[\s\-\(\)\.]/g, '').trim());
          if (found) {
            contactId = found.contactId;
            Logger.info('[RESCHEDULE] Resolved contactId by phone', { id, contactId });
          }
        }
      }

      // ── Resolve the appointment/event to move ────────────────────────
      let eventId: string | undefined = args.appointmentId;

      if (!eventId) {
        if (!contactId) {
          const error = 'Could not identify the contact to reschedule. Provide a contactId, a phone number, or an appointmentId.';
          Logger.error('[RESCHEDULE] ' + error, { id });
          return { id, ok: false, error };
        }

        const apptResp = await this.httpClient.get(
          `https://services.leadconnectorhq.com/contacts/${contactId}/appointments`,
          {
            headers: {
              'Authorization': `Bearer ${ghlApiKey}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
          }
        );

        if (!apptResp.ok) {
          const error = `Could not fetch existing appointments: ${apptResp.status} ${apptResp.statusText}`;
          Logger.error('[RESCHEDULE] ' + error, { id, contactId, responseData: apptResp.data });
          return { id, ok: false, error };
        }

        const events: any[] = apptResp.data?.events || apptResp.data?.appointments || [];
        const now = Date.now();
        const cancelledStatuses = new Set(['cancelled', 'canceled', 'noshow', 'no-show', 'invalid']);

        // Only consider active, future appointments on the target calendar,
        // then pick the soonest one — that is the booking the caller means.
        const candidates = events
          .filter(ev => (ev.calendarId ? ev.calendarId === calendarId : true))
          .filter(ev => !cancelledStatuses.has(String(ev.appointmentStatus || ev.status || '').toLowerCase()))
          .map(ev => ({ ev, startMs: new Date(ev.startTime).getTime() }))
          .filter(({ startMs }) => !Number.isNaN(startMs) && startMs >= now)
          .sort((a, b) => a.startMs - b.startMs);

        Logger.info('[RESCHEDULE] Appointment lookup', {
          id,
          contactId,
          totalEvents: events.length,
          candidates: candidates.length,
        });

        if (candidates.length === 0) {
          const error = 'No active upcoming appointment was found for this contact to reschedule.';
          Logger.warn('[RESCHEDULE] ' + error, { id, contactId });
          return { id, ok: false, error };
        }

        const selected = candidates[0]!.ev;
        eventId = selected.id;
        Logger.info('[RESCHEDULE] Selected appointment to move', {
          id,
          eventId,
          currentStart: selected.startTime,
        });
      }

      if (!eventId) {
        const error = 'Appointment ID could not be determined.';
        Logger.error('[RESCHEDULE] ' + error, { id });
        return { id, ok: false, error };
      }

      // ── Reconcile the new slot and update the event in place ─────────
      const selectedSlot = await this.reconcileSlot(id, calendarId, ghlApiKey, args.newStartTime);

      // Derive endTime from the reconciled start so it carries the calendar's
      // own offset and preserves the original duration the caller asked for.
      const durationMs = newEnd.getTime() - newStart.getTime();
      const endSlot = new Date(new Date(selectedSlot).getTime() + durationMs).toISOString();

      const payload: any = {
        calendarId,
        startTime: selectedSlot,
        endTime: endSlot,
      };
      if (args.notes) payload.notes = args.notes;

      Logger.info('[RESCHEDULE] Updating appointment in GHL', { id, eventId, calendarId, selectedSlot, endSlot });

      const response = await this.httpClient.put(
        `https://services.leadconnectorhq.com/calendars/events/appointments/${eventId}`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${ghlApiKey}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
        }
      );

      if (response.ok) {
        Logger.info('[RESCHEDULE] Appointment rescheduled successfully', { id, eventId, responseData: response.data });
        return {
          id,
          ok: true,
          data: {
            appointmentId: eventId,
            calendarId,
            newStartTime: selectedSlot,
            newEndTime: endSlot,
            message: 'Appointment rescheduled successfully',
          },
        };
      }

      const errorDetails = response.data ? JSON.stringify(response.data) : 'No error details';
      const error = `GHL Calendar API failed: ${response.status} ${response.statusText}`;
      Logger.error('[RESCHEDULE] ' + error, { id, eventId, calendarId, payload, responseData: response.data });
      return { id, ok: false, error: `${error}. Details: ${errorDetails}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('[RESCHEDULE] Error in reschedule_appointment', { id, error: errorMessage });
      return { id, ok: false, error: errorMessage };
    }
  }
}

