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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/45188c02-e418-44d6-9c05-ffe9db4a986c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slack-service.ts:116',message:'Data structures for name extraction',data:{callId,ghlMetadata:ghlMetadata?{contact:ghlMetadata.contact}:null,fullCallData:fullCallData?{variables:fullCallData.variables,variableValues:fullCallData.variableValues,metadata:fullCallData.metadata}:null},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      
      // Extract first name and last name (GHL firstName/lastName first, then split "name" when needed)
      let leadFirstName = 'N/A';
      let leadLastName = 'N/A';
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/45188c02-e418-44d6-9c05-ffe9db4a986c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slack-service.ts:154',message:'Before name extraction logic',data:{ghlFirstName:ghlMetadata?.contact?.firstName,ghlLastName:ghlMetadata?.contact?.lastName,vapiName:fullCallData?.variables?.name},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (ghlMetadata?.contact?.firstName) {
        leadFirstName = ghlMetadata.contact.firstName;
        leadLastName = ghlMetadata.contact.lastName || 'N/A';
      } else if (fullCallData?.variables?.name) {
        const nameParts = fullCallData.variables.name.split(' ');
        leadFirstName = nameParts[0] || 'N/A';
        leadLastName = nameParts.slice(1).join(' ') || 'N/A';
      } else if (fullCallData?.variableValues?.name) {
        const nameParts = fullCallData.variableValues.name.split(' ');
        leadFirstName = nameParts[0] || 'N/A';
        leadLastName = nameParts.slice(1).join(' ') || 'N/A';
      } else if (fullCallData?.assistantOverrides?.variableValues?.name) {
        const nameParts = fullCallData.assistantOverrides.variableValues.name.split(' ');
        leadFirstName = nameParts[0] || 'N/A';
        leadLastName = nameParts.slice(1).join(' ') || 'N/A';
      } else if (ghlMetadata?.contact?.name) {
        const nameParts = ghlMetadata.contact.name.split(' ');
        leadFirstName = nameParts[0] || 'N/A';
        leadLastName = nameParts.slice(1).join(' ') || 'N/A';
      } else if (fullCallData?.metadata?.name) {
        const nameParts = fullCallData.metadata.name.split(' ');
        leadFirstName = nameParts[0] || 'N/A';
        leadLastName = nameParts.slice(1).join(' ') || 'N/A';
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/45188c02-e418-44d6-9c05-ffe9db4a986c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slack-service.ts:182',message:'Entering fallback name extraction',data:{variables:fullCallData?.variables,variableValues:fullCallData?.variableValues},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (fullCallData?.variables?.name) leadFirstName = fullCallData.variables.name;
        else if (fullCallData?.variableValues?.name) leadFirstName = fullCallData.variableValues.name;
        else if (fullCallData?.assistantOverrides?.variableValues?.name) leadFirstName = fullCallData.assistantOverrides.variableValues.name;
        else if (ghlMetadata?.contact?.name) leadFirstName = ghlMetadata.contact.name;
        else if (fullCallData?.metadata?.name) leadFirstName = fullCallData.metadata.name;
        leadLastName = fullCallData?.variables?.lastName
          || fullCallData?.variableValues?.lastName
          || fullCallData?.assistantOverrides?.variableValues?.lastName
          || ghlMetadata?.contact?.lastName
          || fullCallData?.metadata?.lastName
          || 'N/A';
      }
      
      // Extract contactId from GHL metadata
      const contactId = ghlMetadata?.contactId 
        || ghlMetadata?.contact?.id 
        || fullCallData?.metadata?.ghl?.contactId
        || null;
      
      // Get locationId from client config
      const locationId = assistantId ? ClientConfigManager.getLocationId(assistantId) : null;
      
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/45188c02-e418-44d6-9c05-ffe9db4a986c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'slack-service.ts:237',message:'Final extracted names',data:{leadFirstName,leadLastName},hypothesisId:'H4',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      // Format date: YYYY-MM-DD HH:MM:SS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      
      // Build full name: combine first + last, omitting "N/A" parts
      let leadFullName = 'N/A';
      if (leadFirstName !== 'N/A' && leadLastName !== 'N/A') {
        leadFullName = `${leadFirstName} ${leadLastName}`;
      } else if (leadFirstName !== 'N/A') {
        leadFullName = leadFirstName;
      } else if (leadLastName !== 'N/A') {
        leadFullName = leadLastName;
      }

      // Build the message with exact format requested
      let message = `<!channel> New Call Recording & Report Just Dropped\n\n`;
      message += `*Practice Name:* ${clientName}\n`;
      message += `*Name:* ${leadFullName}\n`;
      message += `*Email:* ${leadEmail}\n`;
      message += `*Phone:* ${leadPhone}\n`;
      message += `*GHL Contact:* ${ghlContactLink}\n`;
      
      if (context?.summary) {
        message += `*Summary:* ${context.summary}\n`;
      }
      
      message += `*Date:* ${formattedDate}\n`;
      message += `*Call recording:* ${recordingUrl}`;

      // Send the message
      await this.sendMessage({
        channelId: this.defaultChannelId,
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