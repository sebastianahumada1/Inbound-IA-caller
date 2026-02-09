/**
 * State Storage Service
 * 
 * Provides persistent storage for stateless serverless environments (Vercel).
 * Uses Vercel KV (Redis) for data persistence between webhook invocations.
 * 
 * Falls back to in-memory storage for local development if KV is not available.
 */

import { Logger } from './logger.js';

/**
 * Safely parse a value that might already be an object (Vercel KV auto-deserializes)
 * or might be a JSON string (in-memory storage stores raw strings).
 */
function safeParse<T = any>(value: any): T {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  // Already an object (Vercel KV auto-parsed it)
  return value as T;
}

// Try to import Vercel KV at runtime
let kvStorage: any = null;
let kvInitPromise: Promise<void> | null = null;

async function initializeKV() {
  if (kvInitPromise) return kvInitPromise;
  
  kvInitPromise = (async () => {
    try {
      const vercelKv = await import('@vercel/kv');
      kvStorage = vercelKv.kv;
      Logger.info('[STATE_STORAGE] Vercel KV initialized');
    } catch (error) {
      Logger.warn('[STATE_STORAGE] Vercel KV not available, using in-memory fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
  
  return kvInitPromise;
}

/**
 * In-memory storage fallback for local development
 */
class InMemoryStorage {
  private store: Map<string, { value: any; expiry: number | null }> = new Map();

  async set(key: string, value: any, options?: { ex?: number }): Promise<void> {
    const expiry = options?.ex ? Date.now() + options.ex * 1000 : null;
    this.store.set(key, { value, expiry });
  }

  async get<T = any>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  async del(...keys: string[]): Promise<void> {
    keys.forEach(key => this.store.delete(key));
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this.store.has(key)).length;
  }
}

export class StateStorage {
  private prefix: string;
  private ttl: number; // Time to live in seconds
  private storage: any;
  private initialized: boolean = false;

  constructor(prefix = 'vapi', ttl = 86400) { // 24 hours default
    this.prefix = prefix;
    this.ttl = ttl;
    this.storage = new InMemoryStorage();
    
    // Initialize KV asynchronously
    this.initStorage();
  }

  private async initStorage(): Promise<void> {
    if (this.initialized) return;
    
    await initializeKV();
    
    // Use Vercel KV if available, otherwise use in-memory storage
    if (kvStorage) {
      this.storage = kvStorage;
      Logger.info('[STATE_STORAGE] Using Vercel KV storage');
    } else {
      Logger.warn('[STATE_STORAGE] Using in-memory storage (not persistent in Vercel!)');
    }
    
    this.initialized = true;
  }

  /**
   * Check if Vercel KV is available
   */
  isKvAvailable(): boolean {
    return kvStorage !== null;
  }

  /**
   * Store call summary
   */
  async storeCallSummary(callId: string, summary: string): Promise<void> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:summary:${callId}`;
      await this.storage.set(key, summary, { ex: this.ttl });
      Logger.info('[STATE_STORAGE] Summary stored', { 
        callId, 
        ttl: this.ttl,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to store summary', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get call summary
   */
  async getCallSummary(callId: string): Promise<string | null> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:summary:${callId}`;
      const summary: string | null = await this.storage.get(key);
      Logger.info('[STATE_STORAGE] Summary retrieved', { 
        callId, 
        found: !!summary,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
      return summary;
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to get summary', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Check if note was already sent
   */
  async wasNoteSent(callId: string, contactId: string): Promise<boolean> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:note:${callId}:${contactId}`;
      const exists = await this.storage.exists(key);
      return exists === 1;
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to check note status', {
        callId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Mark note as sent
   */
  async markNoteSent(callId: string, contactId: string): Promise<void> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:note:${callId}:${contactId}`;
      await this.storage.set(key, true, { ex: this.ttl });
      Logger.info('[STATE_STORAGE] Note marked as sent', { 
        callId, 
        contactId,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to mark note', {
        callId,
        contactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Store tool call data for later use
   */
  async storeToolCallData(callId: string, data: any): Promise<void> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:toolcall:${callId}`;
      await this.storage.set(key, JSON.stringify(data), { ex: this.ttl });
      Logger.info('[STATE_STORAGE] Tool call data stored', { 
        callId,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to store tool call data', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get tool call data
   */
  async getToolCallData(callId: string): Promise<any | null> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:toolcall:${callId}`;
      const data: string | null = await this.storage.get(key);
      Logger.info('[STATE_STORAGE] Tool call data retrieved', {
        callId,
        found: !!data,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
      return data ? safeParse(data) : null;
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to get tool call data', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Store call metadata (phone, email, etc.)
   */
  async storeCallMetadata(callId: string, metadata: Record<string, any>): Promise<void> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:metadata:${callId}`;
      await this.storage.set(key, JSON.stringify(metadata), { ex: this.ttl });
      Logger.info('[STATE_STORAGE] Call metadata stored', { 
        callId,
        keys: Object.keys(metadata),
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to store metadata', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get call metadata
   */
  async getCallMetadata(callId: string): Promise<Record<string, any> | null> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:metadata:${callId}`;
      const data: string | null = await this.storage.get(key);
      return data ? safeParse(data) : null;
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to get metadata', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Delete call data (cleanup)
   */
  async deleteCallData(callId: string): Promise<void> {
    await this.initStorage();
    try {
      const keys = [
        `${this.prefix}:summary:${callId}`,
        `${this.prefix}:toolcall:${callId}`,
        `${this.prefix}:metadata:${callId}`,
      ];
      await this.storage.del(...keys);
      Logger.info('[STATE_STORAGE] Call data deleted', { 
        callId,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to delete call data', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Store call transcript (accumulates all transcript chunks)
   */
  async storeTranscript(callId: string, transcript: string, role?: 'user' | 'assistant'): Promise<void> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:transcript:${callId}`;
      const existing = await this.storage.get(key);
      const transcriptData = existing ? safeParse(existing) : { fullTranscript: '', chunks: [] };
      
      // Append to full transcript
      transcriptData.fullTranscript += (transcriptData.fullTranscript ? ' ' : '') + transcript;
      
      // Store chunk with role if provided
      if (role) {
        transcriptData.chunks.push({ role, transcript, timestamp: Date.now() });
      }
      
      await this.storage.set(key, JSON.stringify(transcriptData), { ex: this.ttl });
      Logger.info('[STATE_STORAGE] Transcript stored', { 
        callId, 
        transcriptLength: transcriptData.fullTranscript.length,
        chunks: transcriptData.chunks.length,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to store transcript', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get call transcript
   */
  async getTranscript(callId: string): Promise<string | null> {
    await this.initStorage();
    try {
      const key = `${this.prefix}:transcript:${callId}`;
      const data: string | null = await this.storage.get(key);
      if (!data) return null;
      
      const transcriptData = safeParse(data);
      Logger.info('[STATE_STORAGE] Transcript retrieved', {
        callId,
        transcriptLength: transcriptData.fullTranscript?.length || 0,
        chunks: transcriptData.chunks?.length || 0,
        storage: this.isKvAvailable() ? 'KV' : 'memory',
      });
      return transcriptData.fullTranscript || null;
    } catch (error) {
      Logger.error('[STATE_STORAGE] Failed to get transcript', {
        callId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get storage status for health checks
   */
  getStatus(): { type: string; available: boolean; ttl: number } {
    return {
      type: this.isKvAvailable() ? 'Vercel KV' : 'In-Memory',
      available: true,
      ttl: this.ttl,
    };
  }
}

