# Multi-Client Configuration

This document explains how the system automatically selects the correct GHL API key based on the VAPI Assistant ID.

## Overview

The system now supports multiple clients, each with their own:
- VAPI Assistant ID
- GHL API Key
- Optional Slack Channel (for client-specific notifications)

## Configured Clients

The system supports 7 clients, each configured via environment variables:

### 1. Premier Wellness
- **Environment Variables**:
  - `PREMIER_WELLNESS_ASSISTANT_ID`
  - `PREMIER_WELLNESS_GHL_API_KEY`
  - `SLACK_CHANNEL_ID_PREMIER_WELLNESS` (optional)

### 2. West Texas
- **Environment Variables**:
  - `WEST_TEXAS_ASSISTANT_ID`
  - `WEST_TEXAS_GHL_API_KEY`
  - `SLACK_CHANNEL_ID_WEST_TEXAS` (optional)

### 3. Third Client
- **Environment Variables**:
  - `THIRD_CLIENT_ASSISTANT_ID`
  - `THIRD_CLIENT_GHL_API_KEY`
  - `SLACK_CHANNEL_ID_THIRD_CLIENT` (optional)

### 4. Data Driven Practices
- **Environment Variables**:
  - `DATA_DRIVEN_PRACTICES_ASSISTANT_ID`
  - `DATA_DRIVEN_PRACTICES_GHL_API_KEY`
  - `SLACK_CHANNEL_ID_DATA_DRIVEN_PRACTICES` (optional)

### 5. NuVive
- **Environment Variables**:
  - `NUVIVE_ASSISTANT_ID`
  - `NUVIVE_GHL_API_KEY`
  - `SLACK_CHANNEL_ID_NUVIVE` (optional)

### 6. NuWave
- **Environment Variables**:
  - `NUWAVE_ASSISTANT_ID`
  - `NUWAVE_GHL_API_KEY`
  - `NUWAVE_LOCATION_ID`
  - `SLACK_CHANNEL_ID_NUWAVE` (optional)

### 7. ReliefSource
- **Environment Variables**:
  - `RELIEFSOURCE_ASSISTANT_ID`
  - `RELIEFSOURCE_GHL_API_KEY`
  - `RELIEFSOURCE_LOCATION_ID`
  - `SLACK_CHANNEL_ID_RELIEFSOURCE` (optional)

## How It Works

### 1. Automatic Detection
When a webhook arrives from VAPI, the system:
1. Extracts the `assistantId` from the webhook payload
2. Looks up the corresponding client configuration
3. Uses the client-specific GHL API key for all operations

### 2. Configuration Loading
All client configurations are loaded from environment variables in `src/utils/client-config.ts`:

```typescript
// Example: Premier Wellness Configuration
const assistantId = process.env.PREMIER_WELLNESS_ASSISTANT_ID;
const apiKey = process.env.PREMIER_WELLNESS_GHL_API_KEY;

if (assistantId && apiKey) {
  const config: ClientConfig = {
    name: 'Premier Wellness',
    assistantId,
    ghlApiKey: apiKey,
  };
  this.configs.set(assistantId, config);
}
```

The system validates that both Assistant ID and API Key are provided for each client. If any are missing, a warning is logged and that client will not be available.

### 3. Logging
The system logs which client is being processed:

```
[WEBHOOK] Processing message for assistant { 
  type: 'tool-calls', 
  assistantId: '053cd610-596c-4632-a90b-a1e398712178' 
}
[GHL_CONNECTOR] Using client-specific API key { 
  assistantId: '053cd610-596c-4632-a90b-a1e398712178',
  clientName: 'Premier Wellness' 
}
```

## Adding New Clients

To add a new client:

### 1. Add Environment Variables to `.env`

```env
# New Client Configuration
NEW_CLIENT_ASSISTANT_ID=your-assistant-id-here
NEW_CLIENT_GHL_API_KEY=your-ghl-api-key-here
SLACK_CHANNEL_ID_NEW_CLIENT=your-slack-channel-id  # Optional
```

### 2. Update `src/utils/client-config.ts`

Add the new client to the `clientDefinitions` array in the `initialize()` method:

```typescript
const clientDefinitions = [
  // ... existing clients ...
  {
    name: 'New Client Name',
    assistantIdVar: 'NEW_CLIENT_ASSISTANT_ID',
    apiKeyVar: 'NEW_CLIENT_GHL_API_KEY',
    slackChannelVar: 'SLACK_CHANNEL_ID_NEW_CLIENT',
  },
];
```

### 3. Rebuild and Restart

```bash
npm run build
npm start
```

The system will automatically load the new client configuration from environment variables.

## Environment Variables

### Required Per Client
Each client requires two environment variables:
- `{CLIENT}_ASSISTANT_ID` - The VAPI Assistant ID for the client
- `{CLIENT}_GHL_API_KEY` - The GoHighLevel API key for the client

### Client-Specific Variables

**Premier Wellness:**
```env
PREMIER_WELLNESS_ASSISTANT_ID=053cd610-596c-4632-a90b-a1e398712178
PREMIER_WELLNESS_GHL_API_KEY=pit-ea7a24ba-ead3-4076-9afa-e0672c56d0f7
SLACK_CHANNEL_ID_PREMIER_WELLNESS=C09J96WA942  # Optional
```

**West Texas:**
```env
WEST_TEXAS_ASSISTANT_ID=09c07269-4462-4469-96ac-c4eb06146571
WEST_TEXAS_GHL_API_KEY=pit-71098f8f-4b2d-46fb-a5a6-c55cca460ecb
SLACK_CHANNEL_ID_WEST_TEXAS=C09J96WA942  # Optional
```

**Third Client:**
```env
THIRD_CLIENT_ASSISTANT_ID=39ba1969-84bf-4991-ab9e-9b234178f5c2
THIRD_CLIENT_GHL_API_KEY=pit-38da7913-a22e-46b4-873e-f4bb24de234b
SLACK_CHANNEL_ID_THIRD_CLIENT=C09J96WA942  # Optional
```

**Data Driven Practices:**
```env
DATA_DRIVEN_PRACTICES_ASSISTANT_ID=30abcadf-9a7c-4db7-8e5f-3d82977f1f5d
DATA_DRIVEN_PRACTICES_GHL_API_KEY=pit-bd654d7f-815a-4ae1-b593-62a0bc1ca497
SLACK_CHANNEL_ID_DATA_DRIVEN_PRACTICES=C09J96WA942  # Optional
```

**NuVive:**
```env
NUVIVE_ASSISTANT_ID=f395ec8a-e186-4faa-9ea5-ba9bc9b74532
NUVIVE_GHL_API_KEY=pit-71f1a99a-26f0-49f3-9ca8-e07d2771de6b
SLACK_CHANNEL_ID_NUVIVE=C09J96WA942  # Optional
```

**NuWave:**
```env
NUWAVE_ASSISTANT_ID=your-assistant-id-here
NUWAVE_GHL_API_KEY=your-ghl-api-key-here
NUWAVE_LOCATION_ID=your-location-id-here
SLACK_CHANNEL_ID_NUWAVE=C09J96WA942  # Optional
```

**ReliefSource:**
```env
RELIEFSOURCE_ASSISTANT_ID=your-assistant-id-here
RELIEFSOURCE_GHL_API_KEY=your-ghl-api-key-here
RELIEFSOURCE_LOCATION_ID=your-location-id-here
SLACK_CHANNEL_ID_RELIEFSOURCE=C09J96WA942  # Optional
```

### Fallback
- `GHL_API_KEY` - Default/fallback API key (used if no assistant ID match found)

## Fallback Behavior

If the system receives a webhook with an unknown `assistantId`:
1. A warning is logged
2. The default `GHL_API_KEY` from environment variables is used
3. Operations continue normally

## Benefits

✅ **No Manual Switching**: API keys are selected automatically
✅ **Scalable**: Easy to add new clients
✅ **Traceable**: All operations are logged with client names
✅ **Flexible**: Each client can have their own Slack channel
✅ **Safe**: Falls back to default configuration if needed

## Testing

To test with a specific client:

1. Make a call using the VAPI assistant for that client
2. Check the logs for:
   ```
   [WEBHOOK] Processing message for assistant
   [GHL_CONNECTOR] Using client-specific API key
   ```
3. Verify the correct GHL API key is being used

## Architecture

```
VAPI Webhook
    ↓
Extract assistantId
    ↓
ClientConfigManager.getConfigByAssistantId()
    ↓
GHLConnector.setAssistantId()
    ↓
GHLConnector.getGHLApiKey() ← Returns client-specific key
    ↓
GHL API Calls with correct key
```

## Security Notes

✅ **Best Practices Implemented:**
- All API keys and Assistant IDs are stored in environment variables
- No sensitive credentials are hardcoded in source code
- Safe to commit code to public repositories
- Configuration can be different per environment (dev/staging/prod)

**Additional Recommendations:**
- Never commit your `.env` file to version control
- Use a secrets manager (e.g., AWS Secrets Manager, Vercel Environment Variables) for production
- Rotate API keys regularly
- Use different API keys for development and production environments
- Restrict API key permissions to minimum required access

