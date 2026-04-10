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
import { Logger } from '../utils/logger.js';
// ────────────────────────── Helpers ─────────────────────────────────
/**
 * Safely convert a value that might be a string or array to a readable string.
 * HP returns some custom fields as arrays (e.g. multi-select answers).
 */
function stringify(value) {
    if (value === null || value === undefined)
        return "";
    if (typeof value === "string")
        return value;
    if (Array.isArray(value))
        return value.join(", ");
    return String(value);
}
/**
 * Build the full phone in E.164 from HP's separate Mobile + CountryCode fields.
 */
function buildFullPhone(lead, fallback) {
    const mobile = lead.Mobile ?? lead.Phone ?? "";
    if (!mobile)
        return fallback;
    const cc = lead.CountryCode ?? "+1";
    // If mobile already has country code, return as-is
    if (mobile.startsWith("+"))
        return mobile;
    return `${cc}${mobile}`;
}
// ──────────────────────── Decision function ─────────────────────────
/**
 * Decide how to route an inbound call.
 *
 * When a lead is found in HotProspector, ALL their data is passed
 * to the Vapi assistant as `variableValues` so the AI agent can:
 *  - greet the caller by name
 *  - reference their appointment, pain info, etc.
 *  - schedule / reschedule if needed
 */
export function decideCallRoute(lead, context) {
    const defaultAssistantId = process.env.VAPI_ASSISTANT_DEFAULT_ID ?? "";
    const fallbackAssistantId = process.env.VAPI_ASSISTANT_FALLBACK_ID ?? defaultAssistantId;
    // ── Known lead path ──────────────────────────────────────────────
    if (lead) {
        const fullName = `${lead.Firstname ?? ""} ${lead.Lastname ?? ""}`.trim();
        const fullPhone = buildFullPhone(lead, context.callerPhone);
        const cf = lead.Lead_Custom_Fields;
        Logger.info("[CALL_ROUTER] Known lead – routing with full lead data", {
            callId: context.callId,
            leadId: lead.LeadId,
            leadName: fullName,
            hasCustomFields: !!cf,
        });
        // Build variables – the agent's prompt can reference any of these
        // with {{variableName}} in the Vapi assistant configuration.
        const variables = {
            // ── Caller type flag ──
            callerType: "known",
            // ── Core contact info ──
            leadId: lead.LeadId ?? "",
            firstName: lead.Firstname ?? "",
            lastName: lead.Lastname ?? "",
            fullName,
            email: lead["E-Mail"] ?? "",
            phone: fullPhone,
            mobile: lead.Mobile ?? "",
            countryCode: lead.CountryCode ?? "",
            // ── Location / Group ──
            locationId: lead.LocationId ?? "",
            groupId: lead.GroupId ?? "",
            tags: lead.Tags ?? "",
            // ── Address ──
            city: lead.City ?? "",
            state: lead.State ?? "",
            zipcode: lead.Zipcode ?? "",
            address: lead.Address ?? "",
            company: lead.Company ?? "",
        };
        // ── Custom fields (appointment, medical, etc.) ──
        if (cf) {
            variables.appointmentDate = cf.appointment_date ?? "";
            variables.appointmentTime = cf.appointment_time ?? "";
            variables.callCount = cf.call_count ?? "";
            variables.painLocation = stringify(cf.where_is_your_pain_located);
            variables.hasMri = cf.have_you_had_an_mri ?? "";
            variables.reasonableCommute =
                cf.is__custom_valuescity__a_reasonable_commute_for_you ?? "";
            variables.doctorVisit = stringify(cf.have_you_seen_a_doctor_for_your_pain_if_so_what_did_they_tell_you_);
            variables.triedTreatments = stringify(cf.have_you_tried_procedures_or_treatments_for_your_pain);
            variables.symptoms = stringify(cf.describe_your_symptoms_check_all_that_apply);
            variables.takingMedications =
                cf.are_you_currently_taking_medications_for_your_pain ?? "";
            variables.painDuration =
                cf.how_long_have_you_been_suffering_from_back_pain_disc_pain_or_sciatica ?? "";
            variables.sopLink = cf.back__neck_sop_link ?? "";
        }
        Logger.info("[CALL_ROUTER] Variables prepared for agent", {
            callId: context.callId,
            variableKeys: Object.keys(variables),
            variableCount: Object.keys(variables).length,
            firstName: variables.firstName,
            appointmentDate: variables.appointmentDate,
            appointmentTime: variables.appointmentTime,
        });
        return {
            assistantId: defaultAssistantId,
            variables,
            routeLabel: "known-lead",
        };
    }
    // ── Unknown caller path ──────────────────────────────────────────
    Logger.info("[CALL_ROUTER] Unknown caller – using fallback assistant", {
        callId: context.callId,
        phone: context.callerPhone,
    });
    return {
        assistantId: fallbackAssistantId,
        variables: {
            phone: context.callerPhone,
            callerType: "unknown",
        },
        routeLabel: "unknown-caller",
    };
}
// ──────────────── Schedule appointment (stub) ──────────────────────
/**
 * Schedule an appointment for a lead.
 *
 * **Stub** – replace with real GHL calendar / custom booking logic.
 * The existing `ghl.ts → scheduleAppointment()` already handles the
 * outbound flow; this stub exists so the inbound flow can call the
 * same concept without duplicating the GHL plumbing.
 */
export async function scheduleAppointment(lead, context) {
    Logger.info("[CALL_ROUTER] scheduleAppointment stub called", {
        callId: context.callId,
        leadId: lead?.LeadId,
    });
    // TODO: Wire up to GHLConnector.scheduleAppointment() when the
    //       inbound flow needs real scheduling during the webhook.
    return {
        ok: false,
        message: "scheduleAppointment stub – implement real logic when requirements are finalised",
    };
}
