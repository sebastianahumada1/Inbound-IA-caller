import { z } from 'zod';
export declare const VapiToolCallSchema: z.ZodEffects<z.ZodObject<{
    id: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    function: z.ZodOptional<z.ZodObject<{
        name: z.ZodString;
        arguments: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        name: string;
        arguments?: any;
    }, {
        name: string;
        arguments?: any;
    }>>;
    name: z.ZodOptional<z.ZodString>;
    arguments: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodString]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    function?: {
        name: string;
        arguments?: any;
    } | undefined;
    type?: string | undefined;
    name?: string | undefined;
    arguments?: string | Record<string, any> | undefined;
}, {
    id: string;
    function?: {
        name: string;
        arguments?: any;
    } | undefined;
    type?: string | undefined;
    name?: string | undefined;
    arguments?: string | Record<string, any> | undefined;
}>, {
    id: string;
    name: string;
    arguments: any;
}, {
    id: string;
    function?: {
        name: string;
        arguments?: any;
    } | undefined;
    type?: string | undefined;
    name?: string | undefined;
    arguments?: string | Record<string, any> | undefined;
}>;
export declare const VapiToolCallsMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool-calls">;
    toolCallList: z.ZodArray<z.ZodEffects<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        function: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            arguments: z.ZodAny;
        }, "strip", z.ZodTypeAny, {
            name: string;
            arguments?: any;
        }, {
            name: string;
            arguments?: any;
        }>>;
        name: z.ZodOptional<z.ZodString>;
        arguments: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodString]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }>, {
        id: string;
        name: string;
        arguments: any;
    }, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }>, "many">;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        assistantId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        assistantId?: string | undefined;
        id?: string | undefined;
    }, {
        assistantId?: string | undefined;
        id?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "tool-calls";
    toolCallList: {
        id: string;
        name: string;
        arguments: any;
    }[];
    call?: {
        assistantId?: string | undefined;
        id?: string | undefined;
    } | undefined;
}, {
    type: "tool-calls";
    toolCallList: {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }[];
    call?: {
        assistantId?: string | undefined;
        id?: string | undefined;
    } | undefined;
}>;
export declare const VapiCallEndedMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"call.ended">;
    endedReason: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "call.ended";
    call?: {
        id: string;
    } | undefined;
    endedReason?: string | undefined;
}, {
    type: "call.ended";
    call?: {
        id: string;
    } | undefined;
    endedReason?: string | undefined;
}>;
export declare const VapiEndOfCallReportMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"end-of-call-report">;
    timestamp: z.ZodOptional<z.ZodNumber>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        assistantId: z.ZodOptional<z.ZodString>;
        recordingUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    }, {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    }>>;
    endedReason: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodNumber>;
    analysis: z.ZodOptional<z.ZodObject<{
        summary: z.ZodOptional<z.ZodString>;
        sentiment: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        actionItems: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    }, {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    }>>;
    recordingUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "end-of-call-report";
    duration?: number | undefined;
    call?: {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    } | undefined;
    endedReason?: string | undefined;
    timestamp?: number | undefined;
    recordingUrl?: string | undefined;
    cost?: number | undefined;
    analysis?: {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    } | undefined;
}, {
    type: "end-of-call-report";
    duration?: number | undefined;
    call?: {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    } | undefined;
    endedReason?: string | undefined;
    timestamp?: number | undefined;
    recordingUrl?: string | undefined;
    cost?: number | undefined;
    analysis?: {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    } | undefined;
}>;
export declare const VapiTranscriptMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"transcript">;
    transcript: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    role: z.ZodOptional<z.ZodEnum<["user", "assistant"]>>;
    isFinal: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "transcript";
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    transcript?: string | undefined;
    role?: "user" | "assistant" | undefined;
    isFinal?: boolean | undefined;
}, {
    type: "transcript";
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    transcript?: string | undefined;
    role?: "user" | "assistant" | undefined;
    isFinal?: boolean | undefined;
}>;
export declare const VapiStatusUpdateMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"status-update">;
    status: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "status-update";
    status?: string | undefined;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    details?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    type: "status-update";
    status?: string | undefined;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    details?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export declare const VapiMetadataMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"metadata">;
    metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "metadata";
    metadata: Record<string, any>;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    source?: string | undefined;
    category?: string | undefined;
}, {
    type: "metadata";
    metadata: Record<string, any>;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    source?: string | undefined;
    category?: string | undefined;
}>;
export declare const VapiGhlToolMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"ghl_tool">;
    tool: z.ZodObject<{
        name: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        action: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    }, {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    }>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "ghl_tool";
    tool: {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    };
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    type: "ghl_tool";
    tool: {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    };
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export declare const VapiWebhookMessageSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"tool-calls">;
    toolCallList: z.ZodArray<z.ZodEffects<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        function: z.ZodOptional<z.ZodObject<{
            name: z.ZodString;
            arguments: z.ZodAny;
        }, "strip", z.ZodTypeAny, {
            name: string;
            arguments?: any;
        }, {
            name: string;
            arguments?: any;
        }>>;
        name: z.ZodOptional<z.ZodString>;
        arguments: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodString]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }>, {
        id: string;
        name: string;
        arguments: any;
    }, {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }>, "many">;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        assistantId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        assistantId?: string | undefined;
        id?: string | undefined;
    }, {
        assistantId?: string | undefined;
        id?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "tool-calls";
    toolCallList: {
        id: string;
        name: string;
        arguments: any;
    }[];
    call?: {
        assistantId?: string | undefined;
        id?: string | undefined;
    } | undefined;
}, {
    type: "tool-calls";
    toolCallList: {
        id: string;
        function?: {
            name: string;
            arguments?: any;
        } | undefined;
        type?: string | undefined;
        name?: string | undefined;
        arguments?: string | Record<string, any> | undefined;
    }[];
    call?: {
        assistantId?: string | undefined;
        id?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"call.ended">;
    endedReason: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "call.ended";
    call?: {
        id: string;
    } | undefined;
    endedReason?: string | undefined;
}, {
    type: "call.ended";
    call?: {
        id: string;
    } | undefined;
    endedReason?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"end-of-call-report">;
    timestamp: z.ZodOptional<z.ZodNumber>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        assistantId: z.ZodOptional<z.ZodString>;
        recordingUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    }, {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    }>>;
    endedReason: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodNumber>;
    analysis: z.ZodOptional<z.ZodObject<{
        summary: z.ZodOptional<z.ZodString>;
        sentiment: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        actionItems: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    }, {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    }>>;
    recordingUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "end-of-call-report";
    duration?: number | undefined;
    call?: {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    } | undefined;
    endedReason?: string | undefined;
    timestamp?: number | undefined;
    recordingUrl?: string | undefined;
    cost?: number | undefined;
    analysis?: {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    } | undefined;
}, {
    type: "end-of-call-report";
    duration?: number | undefined;
    call?: {
        id: string;
        assistantId?: string | undefined;
        recordingUrl?: string | undefined;
    } | undefined;
    endedReason?: string | undefined;
    timestamp?: number | undefined;
    recordingUrl?: string | undefined;
    cost?: number | undefined;
    analysis?: {
        summary?: string | undefined;
        sentiment?: string | undefined;
        keywords?: string[] | undefined;
        actionItems?: string[] | undefined;
    } | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"transcript">;
    transcript: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    role: z.ZodOptional<z.ZodEnum<["user", "assistant"]>>;
    isFinal: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "transcript";
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    transcript?: string | undefined;
    role?: "user" | "assistant" | undefined;
    isFinal?: boolean | undefined;
}, {
    type: "transcript";
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    transcript?: string | undefined;
    role?: "user" | "assistant" | undefined;
    isFinal?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"status-update">;
    status: z.ZodOptional<z.ZodString>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    details: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "status-update";
    status?: string | undefined;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    details?: string | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    type: "status-update";
    status?: string | undefined;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    details?: string | undefined;
    metadata?: Record<string, any> | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"metadata">;
    metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    source: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "metadata";
    metadata: Record<string, any>;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    source?: string | undefined;
    category?: string | undefined;
}, {
    type: "metadata";
    metadata: Record<string, any>;
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    source?: string | undefined;
    category?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"ghl_tool">;
    tool: z.ZodObject<{
        name: z.ZodString;
        parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        action: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    }, {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    }>;
    call: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>>;
    timestamp: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: "ghl_tool";
    tool: {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    };
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    type: "ghl_tool";
    tool: {
        name: string;
        parameters?: Record<string, any> | undefined;
        action?: string | undefined;
    };
    call?: {
        id: string;
    } | undefined;
    timestamp?: number | undefined;
    metadata?: Record<string, any> | undefined;
}>]>;
export declare const VapiWebhookBodySchema: z.ZodObject<{
    message: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"tool-calls">;
        toolCallList: z.ZodArray<z.ZodEffects<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodOptional<z.ZodString>;
            function: z.ZodOptional<z.ZodObject<{
                name: z.ZodString;
                arguments: z.ZodAny;
            }, "strip", z.ZodTypeAny, {
                name: string;
                arguments?: any;
            }, {
                name: string;
                arguments?: any;
            }>>;
            name: z.ZodOptional<z.ZodString>;
            arguments: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodString]>>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            function?: {
                name: string;
                arguments?: any;
            } | undefined;
            type?: string | undefined;
            name?: string | undefined;
            arguments?: string | Record<string, any> | undefined;
        }, {
            id: string;
            function?: {
                name: string;
                arguments?: any;
            } | undefined;
            type?: string | undefined;
            name?: string | undefined;
            arguments?: string | Record<string, any> | undefined;
        }>, {
            id: string;
            name: string;
            arguments: any;
        }, {
            id: string;
            function?: {
                name: string;
                arguments?: any;
            } | undefined;
            type?: string | undefined;
            name?: string | undefined;
            arguments?: string | Record<string, any> | undefined;
        }>, "many">;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            assistantId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            assistantId?: string | undefined;
            id?: string | undefined;
        }, {
            assistantId?: string | undefined;
            id?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "tool-calls";
        toolCallList: {
            id: string;
            name: string;
            arguments: any;
        }[];
        call?: {
            assistantId?: string | undefined;
            id?: string | undefined;
        } | undefined;
    }, {
        type: "tool-calls";
        toolCallList: {
            id: string;
            function?: {
                name: string;
                arguments?: any;
            } | undefined;
            type?: string | undefined;
            name?: string | undefined;
            arguments?: string | Record<string, any> | undefined;
        }[];
        call?: {
            assistantId?: string | undefined;
            id?: string | undefined;
        } | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"call.ended">;
        endedReason: z.ZodOptional<z.ZodString>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        type: "call.ended";
        call?: {
            id: string;
        } | undefined;
        endedReason?: string | undefined;
    }, {
        type: "call.ended";
        call?: {
            id: string;
        } | undefined;
        endedReason?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"end-of-call-report">;
        timestamp: z.ZodOptional<z.ZodNumber>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            assistantId: z.ZodOptional<z.ZodString>;
            recordingUrl: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        }, {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        }>>;
        endedReason: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodNumber>;
        cost: z.ZodOptional<z.ZodNumber>;
        analysis: z.ZodOptional<z.ZodObject<{
            summary: z.ZodOptional<z.ZodString>;
            sentiment: z.ZodOptional<z.ZodString>;
            keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            actionItems: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        }, {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        }>>;
        recordingUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "end-of-call-report";
        duration?: number | undefined;
        call?: {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        } | undefined;
        endedReason?: string | undefined;
        timestamp?: number | undefined;
        recordingUrl?: string | undefined;
        cost?: number | undefined;
        analysis?: {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        } | undefined;
    }, {
        type: "end-of-call-report";
        duration?: number | undefined;
        call?: {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        } | undefined;
        endedReason?: string | undefined;
        timestamp?: number | undefined;
        recordingUrl?: string | undefined;
        cost?: number | undefined;
        analysis?: {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        } | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"transcript">;
        transcript: z.ZodOptional<z.ZodString>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>>;
        timestamp: z.ZodOptional<z.ZodNumber>;
        role: z.ZodOptional<z.ZodEnum<["user", "assistant"]>>;
        isFinal: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        type: "transcript";
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        transcript?: string | undefined;
        role?: "user" | "assistant" | undefined;
        isFinal?: boolean | undefined;
    }, {
        type: "transcript";
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        transcript?: string | undefined;
        role?: "user" | "assistant" | undefined;
        isFinal?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"status-update">;
        status: z.ZodOptional<z.ZodString>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>>;
        timestamp: z.ZodOptional<z.ZodNumber>;
        details: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "status-update";
        status?: string | undefined;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        details?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        type: "status-update";
        status?: string | undefined;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        details?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"metadata">;
        metadata: z.ZodRecord<z.ZodString, z.ZodAny>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>>;
        timestamp: z.ZodOptional<z.ZodNumber>;
        source: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "metadata";
        metadata: Record<string, any>;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        source?: string | undefined;
        category?: string | undefined;
    }, {
        type: "metadata";
        metadata: Record<string, any>;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        source?: string | undefined;
        category?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"ghl_tool">;
        tool: z.ZodObject<{
            name: z.ZodString;
            parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
            action: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        }, {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        }>;
        call: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
        }, {
            id: string;
        }>>;
        timestamp: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        type: "ghl_tool";
        tool: {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        };
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        type: "ghl_tool";
        tool: {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        };
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        metadata?: Record<string, any> | undefined;
    }>]>;
}, "strip", z.ZodTypeAny, {
    message: {
        type: "tool-calls";
        toolCallList: {
            id: string;
            name: string;
            arguments: any;
        }[];
        call?: {
            assistantId?: string | undefined;
            id?: string | undefined;
        } | undefined;
    } | {
        type: "call.ended";
        call?: {
            id: string;
        } | undefined;
        endedReason?: string | undefined;
    } | {
        type: "end-of-call-report";
        duration?: number | undefined;
        call?: {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        } | undefined;
        endedReason?: string | undefined;
        timestamp?: number | undefined;
        recordingUrl?: string | undefined;
        cost?: number | undefined;
        analysis?: {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        } | undefined;
    } | {
        type: "transcript";
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        transcript?: string | undefined;
        role?: "user" | "assistant" | undefined;
        isFinal?: boolean | undefined;
    } | {
        type: "status-update";
        status?: string | undefined;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        details?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | {
        type: "metadata";
        metadata: Record<string, any>;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        source?: string | undefined;
        category?: string | undefined;
    } | {
        type: "ghl_tool";
        tool: {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        };
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        metadata?: Record<string, any> | undefined;
    };
}, {
    message: {
        type: "tool-calls";
        toolCallList: {
            id: string;
            function?: {
                name: string;
                arguments?: any;
            } | undefined;
            type?: string | undefined;
            name?: string | undefined;
            arguments?: string | Record<string, any> | undefined;
        }[];
        call?: {
            assistantId?: string | undefined;
            id?: string | undefined;
        } | undefined;
    } | {
        type: "call.ended";
        call?: {
            id: string;
        } | undefined;
        endedReason?: string | undefined;
    } | {
        type: "end-of-call-report";
        duration?: number | undefined;
        call?: {
            id: string;
            assistantId?: string | undefined;
            recordingUrl?: string | undefined;
        } | undefined;
        endedReason?: string | undefined;
        timestamp?: number | undefined;
        recordingUrl?: string | undefined;
        cost?: number | undefined;
        analysis?: {
            summary?: string | undefined;
            sentiment?: string | undefined;
            keywords?: string[] | undefined;
            actionItems?: string[] | undefined;
        } | undefined;
    } | {
        type: "transcript";
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        transcript?: string | undefined;
        role?: "user" | "assistant" | undefined;
        isFinal?: boolean | undefined;
    } | {
        type: "status-update";
        status?: string | undefined;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        details?: string | undefined;
        metadata?: Record<string, any> | undefined;
    } | {
        type: "metadata";
        metadata: Record<string, any>;
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        source?: string | undefined;
        category?: string | undefined;
    } | {
        type: "ghl_tool";
        tool: {
            name: string;
            parameters?: Record<string, any> | undefined;
            action?: string | undefined;
        };
        call?: {
            id: string;
        } | undefined;
        timestamp?: number | undefined;
        metadata?: Record<string, any> | undefined;
    };
}>;
export declare const SendSmsArgsSchema: z.ZodObject<{
    phone: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    template: z.ZodOptional<z.ZodEnum<["booking", "deposit"]>>;
    callId: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodEnum<["primary", "secondary", "third", "fourth"]>>>;
}, "strip", z.ZodTypeAny, {
    body: string;
    phone: string;
    apiKey: "primary" | "secondary" | "third" | "fourth";
    firstName?: string | undefined;
    template?: "booking" | "deposit" | undefined;
    callId?: string | undefined;
}, {
    body: string;
    phone: string;
    firstName?: string | undefined;
    template?: "booking" | "deposit" | undefined;
    callId?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
}>;
export declare const UpsertContactArgsSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodEnum<["primary", "secondary", "third", "fourth"]>>>;
}, "strip", z.ZodTypeAny, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    name?: string | undefined;
    phone?: string | undefined;
    firstName?: string | undefined;
    email?: string | undefined;
    lastName?: string | undefined;
}, {
    name?: string | undefined;
    phone?: string | undefined;
    firstName?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
    lastName?: string | undefined;
}>, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    name?: string | undefined;
    phone?: string | undefined;
    firstName?: string | undefined;
    email?: string | undefined;
    lastName?: string | undefined;
}, {
    name?: string | undefined;
    phone?: string | undefined;
    firstName?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
    lastName?: string | undefined;
}>;
export declare const AddTagArgsSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    tag: z.ZodString;
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodEnum<["primary", "secondary", "third", "fourth"]>>>;
}, "strip", z.ZodTypeAny, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    tag: string;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    tag: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
}>, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    tag: string;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    tag: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
}>;
export declare const AddNoteArgsSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    note: z.ZodString;
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodEnum<["primary", "secondary", "third", "fourth"]>>>;
}, "strip", z.ZodTypeAny, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    note: string;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    note: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
}>, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    note: string;
    phone?: string | undefined;
    email?: string | undefined;
}, {
    note: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
}>;
export declare const UpdateStageArgsSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    pipelineId: z.ZodString;
    stageId: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    apiKey: z.ZodDefault<z.ZodOptional<z.ZodEnum<["primary", "secondary", "third", "fourth"]>>>;
}, "strip", z.ZodTypeAny, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    pipelineId: string;
    stageId: string;
    phone?: string | undefined;
    email?: string | undefined;
    note?: string | undefined;
}, {
    pipelineId: string;
    stageId: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
    note?: string | undefined;
}>, {
    apiKey: "primary" | "secondary" | "third" | "fourth";
    pipelineId: string;
    stageId: string;
    phone?: string | undefined;
    email?: string | undefined;
    note?: string | undefined;
}, {
    pipelineId: string;
    stageId: string;
    phone?: string | undefined;
    apiKey?: "primary" | "secondary" | "third" | "fourth" | undefined;
    email?: string | undefined;
    note?: string | undefined;
}>;
export declare const CheckCalendarAvailabilityArgsSchema: z.ZodObject<{
    dateTime: z.ZodString;
    durationMinutes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    dateTime: string;
    durationMinutes: number;
}, {
    dateTime: string;
    durationMinutes?: number | undefined;
}>;
export declare const ScheduleAppointmentArgsSchema: z.ZodObject<{
    contactId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    startTime: string;
    endTime: string;
    notes: string;
    phone?: string | undefined;
    contactId?: string | undefined;
}, {
    name: string;
    startTime: string;
    endTime: string;
    phone?: string | undefined;
    contactId?: string | undefined;
    notes?: string | undefined;
}>;
export declare const CheckCallbackAvailabilityArgsSchema: z.ZodObject<{
    dateTime: z.ZodString;
    durationMinutes: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    dateTime: string;
    durationMinutes: number;
}, {
    dateTime: string;
    durationMinutes?: number | undefined;
}>;
export declare const ScheduleCallbackArgsSchema: z.ZodObject<{
    contactId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    startTime: z.ZodString;
    endTime: z.ZodString;
    notes: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    startTime: string;
    endTime: string;
    notes: string;
    phone?: string | undefined;
    contactId?: string | undefined;
}, {
    name: string;
    startTime: string;
    endTime: string;
    phone?: string | undefined;
    contactId?: string | undefined;
    notes?: string | undefined;
}>;
export declare const ToolResultSchema: z.ZodObject<{
    id: z.ZodString;
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodAny>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    id: string;
    error?: string | undefined;
    data?: any;
}, {
    ok: boolean;
    id: string;
    error?: string | undefined;
    data?: any;
}>;
export declare const WebhookResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    results: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ok: z.ZodBoolean;
        data: z.ZodOptional<z.ZodAny>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        ok: boolean;
        id: string;
        error?: string | undefined;
        data?: any;
    }, {
        ok: boolean;
        id: string;
        error?: string | undefined;
        data?: any;
    }>, "many">>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    message?: string | undefined;
    results?: {
        ok: boolean;
        id: string;
        error?: string | undefined;
        data?: any;
    }[] | undefined;
}, {
    ok: boolean;
    message?: string | undefined;
    results?: {
        ok: boolean;
        id: string;
        error?: string | undefined;
        data?: any;
    }[] | undefined;
}>;
export type VapiWebhookBody = z.infer<typeof VapiWebhookBodySchema>;
export type VapiToolCall = z.infer<typeof VapiToolCallSchema>;
export type SendSmsArgs = z.infer<typeof SendSmsArgsSchema>;
export type UpsertContactArgs = z.infer<typeof UpsertContactArgsSchema>;
export type AddTagArgs = z.infer<typeof AddTagArgsSchema>;
export type AddNoteArgs = z.infer<typeof AddNoteArgsSchema>;
export type UpdateStageArgs = z.infer<typeof UpdateStageArgsSchema>;
export type CheckCalendarAvailabilityArgs = z.infer<typeof CheckCalendarAvailabilityArgsSchema>;
export type ScheduleAppointmentArgs = z.infer<typeof ScheduleAppointmentArgsSchema>;
export type CheckCallbackAvailabilityArgs = z.infer<typeof CheckCallbackAvailabilityArgsSchema>;
export type ScheduleCallbackArgs = z.infer<typeof ScheduleCallbackArgsSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
