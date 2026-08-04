declare function classifyNetworkError(error: any): {
    type: 'TLS_ERROR' | 'TIMEOUT' | 'DNS_ERROR' | 'CONNECTION_REFUSED' | 'SOCKET_HANGUP' | 'API_ERROR' | 'UNKNOWN';
    description: string;
    suggestion: string;
};
export declare class VapiApiClient {
    private client;
    private apiKey;
    private baseURL;
    private isConfigValid;
    constructor();
    private validateConfig;
    testConnection(): Promise<{
        success: boolean;
        latencyMs?: number;
        error?: string;
        diagnostic?: ReturnType<typeof classifyNetworkError>;
    }>;
    getConfigStatus(): {
        baseURL: string;
        apiKeyConfigured: boolean;
        apiKeyLength: number;
        isConfigValid: boolean;
        environment: string;
        isVercel: boolean;
    };
    getCall(callId: string): Promise<any>;
    /**
     * Resolve a short-lived signed URL for a call recording.
     *
     * Recordings live in a private HIPAA R2 bucket, so the recordingUrl that
     * arrives in the webhook is NOT publicly readable — opening it raw returns an
     * authorization error. Vapi's recording endpoint answers with a 302 whose
     * Location header is the signed URL, so the redirect must NOT be followed:
     * following it would download the audio and lose the Location.
     */
    getRecordingSignedUrl(callId: string, type?: string): Promise<string>;
    getCallMetadata(callId: string): Promise<any>;
}
export {};
