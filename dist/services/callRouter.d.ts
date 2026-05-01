/**
 * Call Router Service
 *
 * Centralises the "what do we do with this call?" decision.
 * Used by both the outbound (existing) and inbound (new) flows so
 * business rules live in a single place.
 *
 * Today the functions are *stubs* – fill in real logic as the
 * business rules are defined (transfer map, qualification criteria, etc.).
 */
import type { HotProspectorLead } from '../lib/hotProspector.js';
export interface RouteContext {
    /** Vapi call ID (from the inbound webhook) */
    callId: string;
    /** Caller phone in E.164 */
    callerPhone: string;
    /** Digits-only version of the phone */
    phoneDigits: string;
    /** Whether we found the lead in HotProspector */
    leadFound: boolean;
    /** Raw lead data from HotProspector (null if not found) */
    lead: HotProspectorLead | null;
    /** Any extra metadata from the inbound payload */
    extra?: Record<string, unknown>;
}
export interface RouteDecision {
    /** The Vapi Assistant ID to use for this call */
    assistantId: string;
    /**
     * Variables / overrides to inject into the assistant session.
     * Vapi will receive them as `assistantOverrides.variableValues`.
     */
    variables: Record<string, string>;
    /**
     * Human-readable label for logs (e.g. "known-lead", "unknown-caller",
     * "transfer-to-reception").
     */
    routeLabel: string;
}
export interface ScheduleResult {
    ok: boolean;
    appointmentId?: string;
    message: string;
}
/**
 * Decide how to route an inbound call.
 *
 * When a lead is found in HotProspector, ALL their data is passed
 * to the Vapi assistant as `variableValues` so the AI agent can:
 *  - greet the caller by name
 *  - reference their appointment, pain info, etc.
 *  - schedule / reschedule if needed
 */
export declare function decideCallRoute(lead: HotProspectorLead | null, context: RouteContext): RouteDecision;
/**
 * Schedule an appointment for a lead.
 *
 * **Stub** – replace with real GHL calendar / custom booking logic.
 * The existing `ghl.ts → scheduleAppointment()` already handles the
 * outbound flow; this stub exists so the inbound flow can call the
 * same concept without duplicating the GHL plumbing.
 */
export declare function scheduleAppointment(lead: HotProspectorLead | null, context: RouteContext): Promise<ScheduleResult>;
