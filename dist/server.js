// ⚠️ IMPORTANT: Load environment variables FIRST, before any other imports
// This ensures process.env is populated when modules are imported
import dotenv from 'dotenv';
dotenv.config();
// Now import other modules (they can safely use process.env)
import express from 'express';
import cors from 'cors';
import { VapiWebhookHandler } from './vapi.js';
import { Logger, logRequest } from './utils/logger.js';
import { ClientConfigManager } from './utils/client-config.js';
import { hotProspectorSearchByPhone } from './lib/hotProspector.js';
import { decideCallRoute } from './services/callRouter.js';
const app = express();
const port = process.env.PORT || 3000;
const vapiHandler = new VapiWebhookHandler();
// Middleware for request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logRequest(req.method, req.url, res.statusCode, duration);
    });
    next();
});
// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
};
app.use(cors(corsOptions));
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Dashboard - Main status page
app.get('/', async (_req, res) => {
    // Gather all status information
    const uptime = process.uptime();
    const uptimeFormatted = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
    // Get configured clients
    const allClients = ClientConfigManager.getAllClients();
    const configuredClients = allClients.length;
    // Check configurations
    const configs = {
        webhookToken: !!process.env.WEBHOOK_TOKEN,
        vapiApiKey: !!process.env.VAPI_API_KEY,
        vapiApiBaseUrl: !!process.env.VAPI_API_BASE_URL,
        ghlWebhookDefault: !!process.env.GHL_INCOMING_WEBHOOK_URL_DEFAULT,
        ghlWebhookBooking: !!process.env.GHL_INCOMING_WEBHOOK_URL_BOOKING,
        ghlWebhookDeposit: !!process.env.GHL_INCOMING_WEBHOOK_URL_DEPOSIT,
        slackBotToken: !!process.env.SLACK_BOT_TOKEN,
        slackChannelId: !!process.env.SLACK_CHANNEL_ID,
        clientsConfigured: configuredClients,
    };
    // Inbound / HotProspector configs
    const inboundConfigs = {
        hpApiUid: !!process.env.HP_API_UID,
        hpApiKey: !!process.env.HP_API_KEY,
        hpGroupId: !!process.env.HP_GROUP_ID,
        hpLocationId: !!process.env.HP_LOCATION_ID,
        vapiAssistantDefaultId: !!process.env.VAPI_ASSISTANT_DEFAULT_ID,
        vapiAssistantFallbackId: !!process.env.VAPI_ASSISTANT_FALLBACK_ID,
        vapiWebhookSecret: !!process.env.VAPI_WEBHOOK_SECRET,
    };
    // Check which assistant IDs from Vapi are NOT mapped in client-config
    const knownAssistantIds = allClients.map(c => c.assistantId);
    const inboundDefaultId = process.env.VAPI_ASSISTANT_DEFAULT_ID || '';
    const inboundFallbackId = process.env.VAPI_ASSISTANT_FALLBACK_ID || '';
    const configuredCount = Object.values(configs).filter(v => typeof v === 'boolean' ? v : v > 0).length;
    const totalConfigs = Object.keys(configs).length;
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vapi-GHL Connector | Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: #1a1a24;
      --border: #2a2a3a;
      --text-primary: #f0f0f5;
      --text-secondary: #8888a0;
      --accent-green: #00d97e;
      --accent-red: #ff4757;
      --accent-yellow: #ffc107;
      --accent-blue: #00b4d8;
      --accent-purple: #7c3aed;
      --glow-green: rgba(0, 217, 126, 0.15);
      --glow-red: rgba(255, 71, 87, 0.15);
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Space Grotesk', sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      background-image: 
        radial-gradient(ellipse at top, rgba(124, 58, 237, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(0, 180, 216, 0.08) 0%, transparent 50%);
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    header {
      text-align: center;
      margin-bottom: 50px;
    }
    
    .logo {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
    }
    
    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
    }
    
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 16px 24px;
      border-radius: 12px;
      margin-bottom: 40px;
      font-weight: 500;
    }
    
    .status-banner.online {
      background: var(--glow-green);
      border: 1px solid var(--accent-green);
      color: var(--accent-green);
    }
    
    .status-banner.offline {
      background: var(--glow-red);
      border: 1px solid var(--accent-red);
      color: var(--accent-red);
    }
    
    .pulse {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.1); }
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }
    
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    
    .card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }
    
    .card-icon.purple { background: rgba(124, 58, 237, 0.2); }
    .card-icon.blue { background: rgba(0, 180, 216, 0.2); }
    .card-icon.green { background: rgba(0, 217, 126, 0.2); }
    .card-icon.yellow { background: rgba(255, 193, 7, 0.2); }
    
    .card-title {
      font-size: 1.1rem;
      font-weight: 600;
    }
    
    .config-list {
      list-style: none;
    }
    
    .config-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    
    .config-item:last-child {
      border-bottom: none;
    }
    
    .config-name {
      color: var(--text-secondary);
    }
    
    .config-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    .status-dot.ok { background: var(--accent-green); }
    .status-dot.error { background: var(--accent-red); }
    .status-dot.warning { background: var(--accent-yellow); }
    
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    
    .stat-item {
      background: var(--bg-secondary);
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--accent-blue);
      font-family: 'JetBrains Mono', monospace;
    }
    
    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    
    .endpoints-list {
      list-style: none;
    }
    
    .endpoint-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
      margin-bottom: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    
    .endpoint-method {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }
    
    .endpoint-method.get { background: var(--accent-green); color: #000; }
    .endpoint-method.post { background: var(--accent-blue); color: #000; }
    
    .endpoint-path {
      color: var(--text-primary);
    }
    
    .test-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 20px;
    }
    
    .test-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      font-size: 0.9rem;
    }
    
    .test-btn.primary {
      background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
      color: white;
    }
    
    .test-btn.secondary {
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    
    .test-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    
    .footer {
      text-align: center;
      padding-top: 40px;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    
    .clients-grid {
      display: grid;
      gap: 12px;
    }
    
    .client-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-radius: 8px;
    }
    
    .client-name {
      font-weight: 500;
    }
    
    .client-status {
      font-size: 0.8rem;
      color: var(--accent-green);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1 class="logo">⚡ Vapi-GHL Connector</h1>
      <p class="subtitle">AI Voice Assistant Middleware</p>
    </header>
    
    <div class="status-banner online">
      <div class="pulse"></div>
      <span>System Online — All services operational</span>
    </div>
    
    <div class="grid">
      <!-- Server Status -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon purple">🖥️</div>
          <h2 class="card-title">Server Status</h2>
        </div>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-value">${uptimeFormatted}</div>
            <div class="stat-label">Uptime</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${process.version}</div>
            <div class="stat-label">Node Version</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${configuredCount}/${totalConfigs}</div>
            <div class="stat-label">Configs Set</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${process.env.NODE_ENV || 'dev'}</div>
            <div class="stat-label">Environment</div>
          </div>
        </div>
      </div>
      
      <!-- API Keys -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon blue">🔑</div>
          <h2 class="card-title">API Keys Status</h2>
        </div>
        <ul class="config-list">
          <li class="config-item">
            <span class="config-name">VAPI_API_KEY</span>
            <span class="config-status">
              <span class="status-dot ${configs.vapiApiKey ? 'ok' : 'error'}"></span>
              ${configs.vapiApiKey ? 'Configured' : 'Missing'}
            </span>
          </li>
        </ul>
      </div>
      
      <!-- Multi-Client Configuration -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon blue">👥</div>
          <h2 class="card-title">Client Configurations (${configuredClients}/5)</h2>
        </div>
        <ul class="config-list">
          ${allClients.map(client => `
          <li class="config-item">
            <span class="config-name">${client.name}</span>
            <span class="config-status">
              <span class="status-dot ok"></span>
              Configured
            </span>
          </li>
          `).join('')}
          ${configuredClients === 0 ? `
          <li class="config-item">
            <span class="config-name" style="color: var(--accent-yellow);">⚠️ No clients configured</span>
            <span class="config-status">
              <span class="status-dot warning"></span>
              Check .env file
            </span>
          </li>
          ` : ''}
        </ul>
      </div>
      
      <!-- Webhooks -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon green">🔗</div>
          <h2 class="card-title">Webhooks & Integrations</h2>
        </div>
        <ul class="config-list">
          <li class="config-item">
            <span class="config-name">WEBHOOK_TOKEN</span>
            <span class="config-status">
              <span class="status-dot ${configs.webhookToken ? 'ok' : 'error'}"></span>
              ${configs.webhookToken ? 'Secured' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">GHL Default Webhook</span>
            <span class="config-status">
              <span class="status-dot ${configs.ghlWebhookDefault ? 'ok' : 'warning'}"></span>
              ${configs.ghlWebhookDefault ? 'Configured' : 'Not set'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">Slack Bot Token</span>
            <span class="config-status">
              <span class="status-dot ${configs.slackBotToken ? 'ok' : 'warning'}"></span>
              ${configs.slackBotToken ? 'Connected' : 'Not set'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">Slack Channel</span>
            <span class="config-status">
              <span class="status-dot ${configs.slackChannelId ? 'ok' : 'warning'}"></span>
              ${configs.slackChannelId ? 'Configured' : 'Not set'}
            </span>
          </li>
        </ul>
      </div>
      
      <!-- Inbound / HotProspector Config -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon yellow">📞</div>
          <h2 class="card-title">Inbound & HotProspector</h2>
        </div>
        <ul class="config-list">
          <li class="config-item">
            <span class="config-name">HP_API_UID</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.hpApiUid ? 'ok' : 'error'}"></span>
              ${inboundConfigs.hpApiUid ? 'Configured' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">HP_API_KEY</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.hpApiKey ? 'ok' : 'error'}"></span>
              ${inboundConfigs.hpApiKey ? 'Configured' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">HP_GROUP_ID</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.hpGroupId ? 'ok' : 'error'}"></span>
              ${inboundConfigs.hpGroupId ? 'Configured' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">HP_LOCATION_ID</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.hpLocationId ? 'ok' : 'error'}"></span>
              ${inboundConfigs.hpLocationId ? 'Configured' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">VAPI_ASSISTANT_DEFAULT_ID</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.vapiAssistantDefaultId ? 'ok' : 'error'}"></span>
              ${inboundConfigs.vapiAssistantDefaultId ? inboundDefaultId.substring(0, 8) + '...' : 'Missing'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">VAPI_ASSISTANT_FALLBACK_ID</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.vapiAssistantFallbackId ? 'ok' : 'warning'}"></span>
              ${inboundConfigs.vapiAssistantFallbackId ? inboundFallbackId.substring(0, 8) + '...' : 'Not set'}
            </span>
          </li>
          <li class="config-item">
            <span class="config-name">VAPI_WEBHOOK_SECRET</span>
            <span class="config-status">
              <span class="status-dot ${inboundConfigs.vapiWebhookSecret ? 'ok' : 'warning'}"></span>
              ${inboundConfigs.vapiWebhookSecret ? 'Secured' : 'Not set'}
            </span>
          </li>
        </ul>
      </div>

      <!-- Assistant ID Mapping Audit -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon purple">🔍</div>
          <h2 class="card-title">Assistant ID Mapping</h2>
        </div>
        <p style="color: var(--text-secondary); margin-bottom: 12px; font-size: 0.85rem;">
          Assistants must be mapped in client-config to process end-of-call reports, GHL notes, and Slack uploads.
        </p>
        <ul class="config-list">
          ${allClients.map(client => `
          <li class="config-item">
            <span class="config-name">${client.name}<br><span style="font-size:0.7rem;color:var(--text-secondary)">${client.assistantId.substring(0, 12)}...</span></span>
            <span class="config-status">
              <span class="status-dot ok"></span>
              Mapped
            </span>
          </li>
          `).join('')}
          ${inboundDefaultId && !knownAssistantIds.includes(inboundDefaultId) ? `
          <li class="config-item" style="background: rgba(255, 71, 87, 0.08); border-radius: 6px; padding: 10px 8px;">
            <span class="config-name" style="color: var(--accent-yellow);">INBOUND DEFAULT<br><span style="font-size:0.7rem">${inboundDefaultId.substring(0, 12)}...</span></span>
            <span class="config-status">
              <span class="status-dot warning"></span>
              Not in client-config
            </span>
          </li>
          ` : ''}
          ${inboundFallbackId && inboundFallbackId !== inboundDefaultId && !knownAssistantIds.includes(inboundFallbackId) ? `
          <li class="config-item" style="background: rgba(255, 71, 87, 0.08); border-radius: 6px; padding: 10px 8px;">
            <span class="config-name" style="color: var(--accent-yellow);">INBOUND FALLBACK<br><span style="font-size:0.7rem">${inboundFallbackId.substring(0, 12)}...</span></span>
            <span class="config-status">
              <span class="status-dot warning"></span>
              Not in client-config
            </span>
          </li>
          ` : ''}
        </ul>
      </div>

      <!-- Endpoints -->
      <div class="card">
        <div class="card-header">
          <div class="card-icon yellow">📡</div>
          <h2 class="card-title">Available Endpoints</h2>
        </div>
        <ul class="endpoints-list">
          <li class="endpoint-item">
            <span class="endpoint-method get">GET</span>
            <span class="endpoint-path">/health</span>
          </li>
          <li class="endpoint-item">
            <span class="endpoint-method post">POST</span>
            <span class="endpoint-path">/vapi/webhook</span>
          </li>
          <li class="endpoint-item">
            <span class="endpoint-method post">POST</span>
            <span class="endpoint-path">/vapi/inbound</span>
          </li>
          <li class="endpoint-item">
            <span class="endpoint-method get">GET</span>
            <span class="endpoint-path">/debug/env</span>
          </li>
          <li class="endpoint-item">
            <span class="endpoint-method get">GET</span>
            <span class="endpoint-path">/debug/network</span>
          </li>
          <li class="endpoint-item">
            <span class="endpoint-method get">GET</span>
            <span class="endpoint-path">/debug/vapi-connection</span>
          </li>
        </ul>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 40px;">
      <div class="card-header">
        <div class="card-icon purple">🧪</div>
        <h2 class="card-title">Quick Tests</h2>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 16px;">
        Run these tests to verify your integrations are working correctly.
      </p>
      <div class="test-buttons">
        <a href="/health" class="test-btn primary" target="_blank">Health Check</a>
        <a href="/debug/env" class="test-btn secondary" target="_blank">View Environment</a>
        <a href="/debug/network" class="test-btn secondary" target="_blank">Test Network</a>
        <a href="/debug/vapi-connection" class="test-btn secondary" target="_blank">Test Vapi API</a>
      </div>
    </div>
    
    <footer class="footer">
      <p>Vapi-GHL Connector v1.0.0 | Running on ${process.env.VERCEL === '1' ? 'Vercel' : 'Local Server'}</p>
      <p style="margin-top: 8px;">Last updated: ${new Date().toISOString()}</p>
    </footer>
  </div>
</body>
</html>
  `;
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
});
// Health check endpoint
app.get('/health', (_req, res) => {
    const storageStatus = vapiHandler.getStorageStatus();
    const healthInfo = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks: {
            webhookToken: !!process.env.WEBHOOK_TOKEN,
            defaultWebhook: !!process.env.GHL_INCOMING_WEBHOOK_URL_DEFAULT,
            bookingWebhook: !!process.env.GHL_INCOMING_WEBHOOK_URL_BOOKING,
            depositWebhook: !!process.env.GHL_INCOMING_WEBHOOK_URL_DEPOSIT,
            vapiApiKey: !!process.env.VAPI_API_KEY,
            vapiApiBaseUrl: !!process.env.VAPI_API_BASE_URL,
            ghlApiKey: !!process.env.GHL_API_KEY,
            slackBotToken: !!process.env.SLACK_BOT_TOKEN,
            slackChannelId: !!process.env.SLACK_CHANNEL_ID,
        },
        features: {
            metadataPull: true,
            ghlToolSupport: true,
            scheduledPolling: true,
            slackIntegration: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID),
            persistentStorage: storageStatus,
        },
    };
    res.status(200).json(healthInfo);
});
// Debug endpoint for environment variables
app.get('/debug/env', (_req, res) => {
    const envInfo = {
        timestamp: new Date().toISOString(),
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            VERCEL: process.env.VERCEL,
            WEBHOOK_TOKEN: process.env.WEBHOOK_TOKEN ? 'Set' : 'Not set',
            GHL_API_KEY: process.env.GHL_API_KEY ? 'Set' : 'Not set',
            VAPI_API_KEY: process.env.VAPI_API_KEY ? 'Set' : 'Not set',
            VAPI_API_BASE_URL: process.env.VAPI_API_BASE_URL || 'Not set (will default to https://api.vapi.ai)',
            GHL_INCOMING_WEBHOOK_URL_DEFAULT: process.env.GHL_INCOMING_WEBHOOK_URL_DEFAULT ? 'Set' : 'Not set',
        },
        apiKeyPreviews: {
            ghlApiKey: process.env.GHL_API_KEY ? process.env.GHL_API_KEY.substring(0, 10) + '...' : 'Not set',
            vapiApiKey: process.env.VAPI_API_KEY ? process.env.VAPI_API_KEY.substring(0, 10) + '...' : 'Not set',
        },
        serverInfo: {
            uptime: process.uptime(),
            nodeVersion: process.version,
            platform: process.platform,
        },
    };
    res.status(200).json(envInfo);
});
// Debug endpoint to test Vapi API connection
app.get('/debug/vapi-connection', async (_req, res) => {
    try {
        Logger.info('[DEBUG] Testing Vapi API connection');
        // Import VapiApiClient dynamically to test
        const { VapiApiClient } = await import('./utils/vapi-client.js');
        const testClient = new VapiApiClient();
        // Get config status
        const configStatus = testClient.getConfigStatus();
        // Test connection
        const connectionResult = await testClient.testConnection();
        const result = {
            timestamp: new Date().toISOString(),
            configStatus,
            connectionTest: connectionResult,
            summary: connectionResult.success
                ? '✅ Connection to Vapi API successful'
                : `❌ Connection failed: ${connectionResult.diagnostic?.type || 'Unknown error'}`,
            recommendation: connectionResult.diagnostic?.suggestion || 'No issues detected',
        };
        Logger.info('[DEBUG] Vapi connection test completed', result);
        res.status(connectionResult.success ? 200 : 500).json(result);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('[DEBUG] Vapi connection test failed', { error: errorMessage });
        res.status(500).json({
            timestamp: new Date().toISOString(),
            error: errorMessage,
            summary: '❌ Failed to test connection',
        });
    }
});
// Debug endpoint to test external HTTPS connectivity
app.get('/debug/network', async (_req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        tests: {},
    };
    // Test various endpoints to diagnose network issues
    const testEndpoints = [
        { name: 'Google (general HTTPS)', url: 'https://www.google.com' },
        { name: 'Vapi API', url: 'https://api.vapi.ai' },
        { name: 'GHL API', url: 'https://services.leadconnectorhq.com' },
    ];
    for (const endpoint of testEndpoints) {
        const startTime = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(endpoint.url, {
                method: 'HEAD',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            results.tests[endpoint.name] = {
                success: true,
                status: response.status,
                latencyMs: Date.now() - startTime,
            };
        }
        catch (error) {
            results.tests[endpoint.name] = {
                success: false,
                error: error.message,
                latencyMs: Date.now() - startTime,
            };
        }
    }
    // Determine overall status
    const allSuccessful = Object.values(results.tests).every((t) => t.success);
    const vapiWorks = results.tests['Vapi API']?.success;
    results.summary = allSuccessful
        ? '✅ All network connections working'
        : vapiWorks
            ? '⚠️ Some connections failed, but Vapi API is reachable'
            : '❌ Cannot reach Vapi API - network issue detected';
    Logger.info('[DEBUG] Network test completed', results);
    res.status(allSuccessful ? 200 : 500).json(results);
});
// Vapi webhook endpoint with token validation
app.post('/vapi/webhook', (req, res, next) => vapiHandler.validateToken(req, res, next), (req, res) => vapiHandler.handleWebhook(req, res));
// Manual metadata pull endpoint (optional)
app.post('/vapi/pull-metadata', (req, res, next) => vapiHandler.validateToken(req, res, next), async (req, res) => {
    try {
        const { callId } = req.body;
        if (!callId) {
            return res.status(400).json({
                ok: false,
                message: 'callId is required',
            });
        }
        Logger.info('[MANUAL_METADATA_PULL] Manual metadata pull requested', { callId });
        const result = await vapiHandler.pullAndProcessGhlMetadata(callId);
        Logger.info('[MANUAL_METADATA_PULL] Manual metadata pull completed', {
            callId,
            success: result.success,
        });
        return res.status(200).json({
            ok: true,
            message: 'Metadata pull completed',
            data: result,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('[MANUAL_METADATA_PULL] Manual metadata pull failed', {
            error: errorMessage,
            body: req.body,
        });
        return res.status(500).json({
            ok: false,
            message: 'Failed to pull metadata',
            error: errorMessage,
        });
    }
});
// Slack connection test endpoint
app.post('/slack/test', (req, res, next) => vapiHandler.validateToken(req, res, next), async (_req, res) => {
    try {
        Logger.info('[SLACK_TEST] Slack connection test requested');
        const isConnected = await vapiHandler.testSlackConnection();
        if (isConnected) {
            Logger.info('[SLACK_TEST] Slack connection test successful');
            return res.status(200).json({
                ok: true,
                message: 'Slack connection successful',
                connected: true,
            });
        }
        else {
            Logger.warn('[SLACK_TEST] Slack connection test failed');
            return res.status(200).json({
                ok: false,
                message: 'Slack connection failed',
                connected: false,
            });
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('[SLACK_TEST] Slack connection test error', {
            error: errorMessage,
        });
        return res.status(500).json({
            ok: false,
            message: 'Slack connection test failed',
            error: errorMessage,
            connected: false,
        });
    }
});
// ─────────────────────────────────────────────────────────────────────
//  INBOUND  –  Vapi sends this webhook when an inbound call arrives.
//  The server looks up the caller in HotProspector, decides the route,
//  and responds with the assistant config that Vapi should use.
// ─────────────────────────────────────────────────────────────────────
/**
 * Extract the caller phone number from the Vapi inbound payload.
 * Tries several paths (Vapi can place it in different locations depending
 * on the phone provider and call type).
 */
function extractCallerPhone(payload) {
    return (payload?.message?.call?.customer?.number ??
        payload?.message?.call?.from ??
        payload?.message?.from ??
        payload?.message?.call?.caller?.number ??
        payload?.call?.customer?.number ??
        payload?.call?.from ??
        payload?.from ??
        payload?.caller?.number ??
        payload?.customer?.number ??
        null);
}
/**
 * Normalise a phone string to E.164 (best-effort).
 * Returns the original string prefixed with "+" when it looks
 * like a full international number without one.
 */
function normalizeToE164(phone) {
    // Remove all whitespace, dashes, parens, dots
    let cleaned = phone.replace(/[\s\-().]/g, '');
    // Already E.164
    if (/^\+\d{7,15}$/.test(cleaned))
        return cleaned;
    // Starts with digits only
    if (/^\d{10}$/.test(cleaned)) {
        // US 10-digit → +1
        return `+1${cleaned}`;
    }
    if (/^1\d{10}$/.test(cleaned)) {
        return `+${cleaned}`;
    }
    // Generic: add + if missing
    if (!cleaned.startsWith('+') && /^\d{7,15}$/.test(cleaned)) {
        return `+${cleaned}`;
    }
    return cleaned;
}
/** Digits only (for HotProspector searchText) */
function toDigitsOnly(phone) {
    return phone.replace(/\D/g, '');
}
app.post('/vapi/inbound', async (req, res) => {
    const startTime = Date.now();
    // ── 1. Validate webhook secret ────────────────────────────────────
    const secret = req.headers['x-vapi-secret'];
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
        Logger.warn('[INBOUND] Invalid or missing x-vapi-secret', {
            provided: secret ? 'present' : 'missing',
            ip: req.ip,
        });
        res.status(401).json({ ok: false, message: 'Unauthorized' });
        return;
    }
    try {
        const payload = req.body;
        const callId = payload?.message?.call?.id ?? payload?.call?.id ?? `inbound_${Date.now()}`;
        Logger.info('[INBOUND] Webhook received', {
            callId,
            messageType: payload?.message?.type,
            hasCall: !!payload?.message?.call,
        });
        // ── 2. Extract & normalise caller phone ─────────────────────────
        const rawPhone = extractCallerPhone(payload);
        if (!rawPhone) {
            Logger.error('[INBOUND] Could not extract caller phone', {
                callId,
                payloadKeys: payload ? Object.keys(payload) : [],
                messageKeys: payload?.message ? Object.keys(payload.message) : [],
            });
            // Respond 200 with fallback assistant so Vapi doesn't retry
            const fallbackId = process.env.VAPI_ASSISTANT_FALLBACK_ID ??
                process.env.VAPI_ASSISTANT_DEFAULT_ID ??
                '';
            res.status(200).json({
                assistantId: fallbackId,
                assistantOverrides: {
                    variableValues: { callerType: 'unknown', phoneExtracted: 'false' },
                },
            });
            return;
        }
        const callerE164 = normalizeToE164(rawPhone);
        const phoneDigits = toDigitsOnly(rawPhone);
        Logger.info('[INBOUND] Caller phone extracted', {
            callId,
            raw: rawPhone,
            e164: callerE164,
            digits: phoneDigits,
        });
        // ── 3. Lookup in HotProspector ──────────────────────────────────
        let hpResult = null;
        try {
            hpResult = await hotProspectorSearchByPhone(callerE164);
            Logger.info('[INBOUND] HotProspector lookup done', {
                callId,
                ok: hpResult.ok,
                count: hpResult.count,
                leadId: hpResult.lead?.LeadId,
            });
        }
        catch (err) {
            Logger.error('[INBOUND] HotProspector lookup failed – continuing with unknown caller path', {
                callId,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
        // ── 4. Route decision ───────────────────────────────────────────
        const routeCtx = {
            callId,
            callerPhone: callerE164,
            phoneDigits,
            leadFound: !!(hpResult?.ok && hpResult.lead),
            lead: hpResult?.lead ?? null,
        };
        const decision = decideCallRoute(hpResult?.lead ?? null, routeCtx);
        Logger.info('[INBOUND] Route decision', {
            callId,
            route: decision.routeLabel,
            assistantId: decision.assistantId,
            variableKeys: Object.keys(decision.variables),
            durationMs: Date.now() - startTime,
        });
        // ── 5. Respond to Vapi ──────────────────────────────────────────
        //   Vapi expects either { assistant: {...} } or { assistantId, assistantOverrides }
        const vapiResponse = {
            assistantId: decision.assistantId,
        };
        if (Object.keys(decision.variables).length > 0) {
            vapiResponse.assistantOverrides = {
                variableValues: decision.variables,
            };
        }
        Logger.info('[INBOUND] Responding to Vapi', {
            callId,
            response: vapiResponse,
            durationMs: Date.now() - startTime,
        });
        res.status(200).json(vapiResponse);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        Logger.error('[INBOUND] Unhandled error', { error: msg });
        // Still return 200 with a fallback so Vapi doesn't hang
        const fallbackId = process.env.VAPI_ASSISTANT_FALLBACK_ID ??
            process.env.VAPI_ASSISTANT_DEFAULT_ID ??
            '';
        res.status(200).json({
            assistantId: fallbackId,
            assistantOverrides: {
                variableValues: { callerType: 'error', errorMessage: msg },
            },
        });
    }
});
// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
    Logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
    });
    res.status(404).json({
        ok: false,
        message: 'Route not found',
        path: req.originalUrl,
    });
});
// Global error handler
app.use((err, req, res, _next) => {
    Logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
    });
    res.status(500).json({
        ok: false,
        message: 'Internal server error',
    });
});
// Graceful shutdown handling
function gracefulShutdown(signal) {
    Logger.info(`Received ${signal}, shutting down gracefully`);
    process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Only start server if not in serverless environment (Vercel, etc.)
// Vercel will handle the server, so we just export the app
if (process.env.VERCEL !== '1' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    app.listen(port, () => {
        Logger.info('Server started', {
            port,
            environment: process.env.NODE_ENV || 'development',
            corsOrigin: process.env.CORS_ORIGIN || '*',
            webhookConfigured: !!process.env.WEBHOOK_TOKEN,
        });
    });
}
export default app;
