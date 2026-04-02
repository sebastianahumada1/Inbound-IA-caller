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
   * Get the Calendar ID based on Assistant ID
   */
  private getCalendarId(): string | null {
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

  async checkCalendarAvailability(id: string, args: CheckCalendarAvailabilityArgs, _callId?: string, _stateStorage?: any): Promise<ToolResult> {
    try {
      Logger.info('[CALENDAR] Processing check_calendar_availability', { id, args });

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

      const calendarId = this.getCalendarId();
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

      // Query GHL Calendar API for free slots
      // We'll check a range around the requested time
      const startDate = new Date(requestedDate.getTime() - 60 * 60000); // 1 hour before
      const endDateRange = new Date(requestedDate.getTime() + 2 * 60 * 60000); // 2 hours after

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

      // GHL returns slots organized by date: { "2025-12-23": { "slots": [...] } }
      // Extract the date key for the requested date (format: YYYY-MM-DD)
      const requestedDateKey = requestedDate.toISOString().split('T')[0];
      
      // Get slots for the requested date
      const dateSlots = requestedDateKey && response.data ? response.data[requestedDateKey] : null;
      const freeSlots = dateSlots?.slots || [];
      
      Logger.info('[CALENDAR] Free slots from GHL', {
        id,
        requestedDateKey,
        freeSlotsCount: freeSlots.length,
        freeSlots: freeSlots,
        requestedDate: requestedDate.toISOString(),
        requestedDateTimestamp: requestedDate.getTime(),
        endDate: endDate.toISOString(),
        endDateTimestamp: endDate.getTime(),
      });

      // GHL returns slots as ISO string times (e.g., "2025-12-23T10:00:00-05:00")
      // Check if the requested time matches any of the available slot start times
      // Since slots are 30-minute intervals, we check if requestedDate matches a slot start time
      const isAvailable = freeSlots.some((slotTime: string) => {
        const slotDate = new Date(slotTime);
        
        // Check if the requested time matches the slot start time (within 1 minute tolerance)
        const timeDiff = Math.abs(requestedDate.getTime() - slotDate.getTime());
        const matches = timeDiff < 60000; // 1 minute tolerance
        
        Logger.debug('[CALENDAR] Comparing slot', {
          slotTime,
          slotDate: slotDate.toISOString(),
          slotDateTimestamp: slotDate.getTime(),
          requestedDate: requestedDate.toISOString(),
          requestedDateTimestamp: requestedDate.getTime(),
          timeDiffMs: timeDiff,
          matches,
        });
        
        return matches;
      });

      Logger.info('[CALENDAR] Availability check completed', {
        id,
        requestedTime: requestedDate.toISOString(),
        isAvailable,
        freeSlotsCount: freeSlots.length,
      });

      return {
        id,
        ok: true,
        data: {
          available: isAvailable,
          requestedTime: requestedDate.toISOString(),
          duration: args.durationMinutes || 30,
          message: isAvailable 
            ? 'The requested time slot is available' 
            : 'The requested time slot is not available',
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

  async scheduleAppointment(id: string, args: ScheduleAppointmentArgs, ghlMetadata?: any, _callId?: string, _stateStorage?: any): Promise<ToolResult> {
    try {
      Logger.info('[CALENDAR] Processing schedule_appointment', { 
        id, 
        args, 
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

      const calendarId = this.getCalendarId();
      if (!calendarId) {
        const error = 'Calendar ID not configured for this client';
        Logger.error('[CALENDAR] ' + error, { id, assistantId: this.assistantId });
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
      
      // GHL expects selectedSlot as ISO string with timezone
      // Use correctedStartTime (already corrected above)
      // If startTime is already in correct format, use it; otherwise convert
      let selectedSlot = correctedStartTime;
      if (!selectedSlot.includes('-05:00') && !selectedSlot.includes('-04:00') && !selectedSlot.includes('-06:00')) {
        // If no timezone, assume EST and add it
        const date = new Date(correctedStartTime);
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
}

