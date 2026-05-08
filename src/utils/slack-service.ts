import { Logger } from './logger.js';

export interface SlackMessageOptions {
  channelId: string;
  text: string;
  threadTs?: string;
}

export class SlackService {
  private botToken: string;
  private defaultChannelId: string;

  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN!;
    this.defaultChannelId = process.env.SLACK_CHANNEL_ID!;

    if (!this.botToken) {
      throw new Error('SLACK_BOT_TOKEN environment variable is required');
    }
    if (!this.defaultChannelId) {
      throw new Error('SLACK_CHANNEL_ID environment variable is required');
    }

    Logger.info('[SLACK_SERVICE] Initialized (Link-based mode)', {
      hasToken: !!this.botToken,
      defaultChannel: this.defaultChannelId,
    });
  }

  /**
   * Sends a text message to a Slack channel
   */
  async sendMessage(options: SlackMessageOptions): Promise<any> {
    const { channelId, text, threadTs } = options;

    try {
      Logger.info('[SLACK_SERVICE] Sending message', {
        channelId,
        textLength: text.length,
        isThread: !!threadTs,
      });

      const payload: any = {
        channel: channelId,
        text: text,
      };

      if (threadTs) {
        payload.thread_ts = threadTs;
      }

      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.ok) {
        throw new Error(`Slack message failed: ${result.error}`);
      }

      Logger.info('[SLACK_SERVICE] Message sent successfully', {
        channelId,
        messageTs: result.ts,
      });

      return result;

    } catch (error) {
      Logger.error('[SLACK_SERVICE] Failed to send message', {
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sends recording link with context message (no file upload)
   */
  async uploadRecordingWithContext(
    recordingUrl: string,
    callId: string,
    assistantId?: string,
    ghlMetadata?: any,
    fullCallData?: any,
    context?: {
      duration?: number;
      cost?: number;
      summary?: string;
      sentiment?: string;
    }
  ): Promise<void> {
    try {
      Logger.info('[SLACK_SERVICE] Sending recording link to Slack', {
        callId,
        recordingUrl,
        hasContext: !!context,
        hasAssistantId: !!assistantId,
        hasGhlMetadata: !!ghlMetadata,
        hasFullCallData: !!fullCallData,
      });

      // Import ClientConfigManager to get client name
      const { ClientConfigManager } = await import('./client-config.js');
      
      // Get client name from assistant ID
      const clientName = assistantId ? ClientConfigManager.getClientName(assistantId) : 'Unknown Client';
      
      // DEBUG: Log all available data structures
      Logger.info('[SLACK_SERVICE] DEBUG - Available data structures', {
        callId,
        hasGhlMetadata: !!ghlMetadata,
        hasFullCallData: !!fullCallData,
        ghlMetadataStructure: ghlMetadata ? {
          keys: Object.keys(ghlMetadata),
          contact: ghlMetadata.contact ? {
            keys: Object.keys(ghlMetadata.contact),
            name: ghlMetadata.contact.name,
            firstName: ghlMetadata.contact.firstName,
            lastName: ghlMetadata.contact.lastName,
            email: ghlMetadata.contact.email,
          } : null,
          raw: JSON.stringify(ghlMetadata).substring(0, 500),
        } : null,
        fullCallDataStructure: fullCallData ? {
          keys: Object.keys(fullCallData),
          hasMetadata: !!fullCallData.metadata,
          metadataKeys: fullCallData.metadata ? Object.keys(fullCallData.metadata) : [],
          metadataName: fullCallData.metadata?.name,
          metadataEmail: fullCallData.metadata?.email,
          hasCustomer: !!fullCallData.customer,
          customerKeys: fullCallData.customer ? Object.keys(fullCallData.customer) : [],
          hasVariables: !!fullCallData.variables,
          variablesKeys: fullCallData.variables ? Object.keys(fullCallData.variables) : [],
          variablesName: fullCallData.variables?.name,
          variablesEmail: fullCallData.variables?.email,
          hasVariableValues: !!fullCallData.variableValues,
          variableValuesKeys: fullCallData.variableValues ? Object.keys(fullCallData.variableValues) : [],
          variableValuesName: fullCallData.variableValues?.name,
          variableValuesEmail: fullCallData.variableValues?.email,
          rawMetadata: fullCallData.metadata ? JSON.stringify(fullCallData.metadata).substring(0, 500) : null,
        } : null,
      });
      
      // Extract first name from multiple possible sources (priority order)
      let leadFirstName = 'N/A';
      if (fullCallData?.variables?.name) {
        leadFirstName = fullCallData.variables.name;
      } else if (fullCallData?.variableValues?.name) {
        leadFirstName = fullCallData.variableValues.name;
      } else if (fullCallData?.assistantOverrides?.variableValues?.name) {
        leadFirstName = fullCallData.assistantOverrides.variableValues.name;
      } else if (ghlMetadata?.contact?.name) {
        leadFirstName = ghlMetadata.contact.name;
      } else if (fullCallData?.metadata?.name) {
        leadFirstName = fullCallData.metadata.name;
      } else if (ghlMetadata?.contact?.firstName) {
        leadFirstName = ghlMetadata.contact.firstName;
      }
      
      // Extract last name from multiple sources
      const leadLastName = fullCallData?.variables?.lastName
        || fullCallData?.variableValues?.lastName
        || fullCallData?.assistantOverrides?.variableValues?.lastName
        || ghlMetadata?.contact?.lastName
        || fullCallData?.metadata?.lastName
        || 'N/A';
      
      // Extract contactId from GHL metadata
      const contactId = ghlMetadata?.contactId 
        || ghlMetadata?.contact?.id 
        || fullCallData?.metadata?.ghl?.contactId
        || null;
      
      // Get locationId from client config or ghlMetadata (HotProspector provides it)
      const locationId = (assistantId ? ClientConfigManager.getLocationId(assistantId) : null)
        || ghlMetadata?.locationId
        || null;
      
      // Build GHL contact link if we have both contactId and locationId
      const ghlContactLink = (contactId && locationId) 
        ? `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`
        : 'N/A';
      
      // Extract email from multiple sources
      const leadEmail = fullCallData?.variables?.email
        || fullCallData?.variableValues?.email
        || fullCallData?.assistantOverrides?.variableValues?.email
        || ghlMetadata?.contact?.email 
        || fullCallData?.metadata?.email 
        || 'N/A';
      
      // Extract phone from multiple sources
      const leadPhone = fullCallData?.variables?.phone
        || fullCallData?.variableValues?.phone
        || fullCallData?.assistantOverrides?.variableValues?.phone
        || ghlMetadata?.contact?.phone
        || ghlMetadata?.contact?.phoneNumber
        || fullCallData?.metadata?.phone
        || fullCallData?.customer?.number
        || 'N/A';
      
      Logger.info('[SLACK_SERVICE] DEBUG - Extracted lead info', {
        callId,
        leadFirstName,
        leadLastName,
        leadEmail,
        leadPhone,
        contactId,
        locationId,
        ghlContactLink,
      });
      
      // Format date: YYYY-MM-DD HH:MM:SS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      
      // Build full name
      const fullName = [leadFirstName, leadLastName].filter(n => n && n !== 'N/A').join(' ') || 'N/A';

      // Build the message with exact format requested
      let message = `<!channel> New Call Recording & Report Just Dropped\n\n`;
      message += `*Practice Name:* ${clientName}\n`;
      message += `*Name:* ${fullName}\n`;
      message += `*Email:* ${leadEmail}\n`;
      message += `*Phone:* ${leadPhone}\n`;
      message += `*GHL Contact:* ${ghlContactLink}\n`;
      
      if (context?.summary) {
        message += `*Summary:* ${context.summary}\n`;
      }
      
      message += `*Date:* ${formattedDate}\n`;
      message += `*Call recording:* ${recordingUrl}`;

      // Use client-specific channel if configured, otherwise fall back to default
      const clientChannelId = assistantId
        ? ClientConfigManager.getSlackChannelId(assistantId) || this.defaultChannelId
        : this.defaultChannelId;

      Logger.info('[SLACK_SERVICE] Resolved Slack channel', {
        callId,
        clientName,
        channelId: clientChannelId,
        isClientSpecific: clientChannelId !== this.defaultChannelId,
      });

      await this.sendMessage({
        channelId: clientChannelId,
        text: message,
      });

      Logger.info('[SLACK_SERVICE] Recording link sent successfully to Slack', {
        callId,
        leadFirstName,
        leadLastName,
        leadEmail,
        leadPhone,
        ghlContactLink,
      });

    } catch (error) {
      Logger.error('[SLACK_SERVICE] Failed to send recording link', {
        callId,
        recordingUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Test the Slack connection
   */
  async testConnection(): Promise<boolean> {
    try {
      Logger.info('[SLACK_SERVICE] Testing connection');

      const response = await fetch('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
        },
      });

      const result = await response.json();

      if (result.ok) {
        Logger.info('[SLACK_SERVICE] Connection test successful', {
          user: result.user,
          team: result.team,
          url: result.url,
        });
        return true;
      } else {
        Logger.error('[SLACK_SERVICE] Connection test failed', {
          error: result.error,
        });
        return false;
      }

    } catch (error) {
      Logger.error('[SLACK_SERVICE] Connection test error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}