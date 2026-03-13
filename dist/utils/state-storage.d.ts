/**
 * State Storage Service
 *
 * Provides persistent storage for stateless serverless environments (Vercel).
 * Uses Vercel KV (Redis) for data persistence between webhook invocations.
 *
 * Falls back to in-memory storage for local development if KV is not available.
 */
export declare class StateStorage {
    private prefix;
    private ttl;
    private storage;
    private initialized;
    constructor(prefix?: string, ttl?: number);
    private initStorage;
    /**
     * Check if Vercel KV is available
     */
    isKvAvailable(): boolean;
    /**
     * Store call summary
     */
    storeCallSummary(callId: string, summary: string): Promise<void>;
    /**
     * Get call summary
     */
    getCallSummary(callId: string): Promise<string | null>;
    /**
     * Check if note was already sent
     */
    wasNoteSent(callId: string, contactId: string): Promise<boolean>;
    /**
     * Mark note as sent
     */
    markNoteSent(callId: string, contactId: string): Promise<void>;
    /**
     * Store tool call data for later use
     */
    storeToolCallData(callId: string, data: any): Promise<void>;
    /**
     * Get tool call data
     */
    getToolCallData(callId: string): Promise<any | null>;
    /**
     * Store call metadata (phone, email, etc.)
     */
    storeCallMetadata(callId: string, metadata: Record<string, any>): Promise<void>;
    /**
     * Get call metadata
     */
    getCallMetadata(callId: string): Promise<Record<string, any> | null>;
    /**
     * Delete call data (cleanup)
     */
    deleteCallData(callId: string): Promise<void>;
    /**
     * Store call transcript (accumulates all transcript chunks)
     */
    storeTranscript(callId: string, transcript: string, role?: 'user' | 'assistant'): Promise<void>;
    /**
     * Get call transcript
     */
    getTranscript(callId: string): Promise<string | null>;
    /**
     * Get storage status for health checks
     */
    getStatus(): {
        type: string;
        available: boolean;
        ttl: number;
    };
}
