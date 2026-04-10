/**
 * HotProspector API Client
 *
 * Reusable service for searching leads in HotProspector via their custom API.
 * Endpoint: POST https://hotprospector.com/glu/custom_api
 * Method  : SearchByUserInput
 */
import { Logger } from '../utils/logger.js';
// ────────────────────────────── Helpers ─────────────────────────────
/** Strip everything that is not a digit.
 * For US numbers (10 or 11 digits starting with 1): return last 10 digits,
 * since HP stores US mobiles without country code.
 * For international numbers (>11 digits or not starting with 1): return all
 * digits so HP can match however the number was stored.
 */
function digitsOnly(phone) {
    const digits = phone.replace(/\D/g, "");
    // US number with country code (+1xxxxxxxxxx = 11 digits starting with 1)
    // or plain 10-digit US number → take last 10 digits.
    if ((digits.length === 11 && digits.startsWith("1")) || digits.length === 10) {
        return digits.slice(-10);
    }
    // International number: keep all digits as-is.
    return digits;
}
// ────────────────────────── Helpers ─────────────────────────────────
/** Execute a single HP search request for a given searchText. */
async function executeHPSearch(api_uId, api_key, GroupId, searchText) {
    const body = {
        api_uId,
        api_key,
        GroupId,
        searchField: "mobile",
        searchText,
        sortBy: "ASC",
        Method: "SearchByUserInput",
    };
    const resp = await fetch("https://app.hotprospector.com/glu/custom_api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        Logger.error("[HOTPROSPECTOR] HTTP error", {
            status: resp.status,
            body: text.substring(0, 500),
        });
        throw new Error(`HotProspector HTTP ${resp.status}: ${text}`);
    }
    const raw = await resp.json();
    const data = Array.isArray(raw) ? raw[0] : raw;
    const results = Array.isArray(data?.Results) ? data.Results : [];
    return {
        ok: data?.response === "true" || data?.response === true,
        count: results.length,
        lead: results[0] ?? null,
    };
}
// ────────────────────────── Main function ───────────────────────────
/**
 * Search HotProspector by phone number.
 * For international numbers, tries the full digit string first, then falls
 * back to the last 10 digits (the format HP typically stores US numbers).
 *
 * @param inputPhone – any format (E.164, with spaces/dashes, etc.)
 * @returns `{ ok, count, lead }` where `lead` is the first result (or null)
 */
export async function hotProspectorSearchByPhone(inputPhone) {
    const api_uId = process.env.HP_API_UID;
    const api_key = process.env.HP_API_KEY;
    const GroupId = process.env.HP_GROUP_ID;
    if (!api_uId || !api_key || !GroupId) {
        const missing = [
            !api_uId && "HP_API_UID",
            !api_key && "HP_API_KEY",
            !GroupId && "HP_GROUP_ID",
        ].filter(Boolean);
        const msg = `HotProspector config incomplete – missing: ${missing.join(", ")}`;
        Logger.error("[HOTPROSPECTOR]" + msg);
        throw new Error(msg);
    }
    const primaryPhone = digitsOnly(inputPhone);
    const last10 = inputPhone.replace(/\D/g, "").slice(-10);
    const needsFallback = primaryPhone !== last10 && last10.length === 10;
    Logger.info("[HOTPROSPECTOR] Searching by phone", {
        inputPhone,
        primaryPhone,
        last10Fallback: needsFallback ? last10 : null,
        GroupId,
    });
    const result = await executeHPSearch(api_uId, api_key, GroupId, primaryPhone);
    // If primary search returned no results and the number is international,
    // retry with the last 10 digits (HP often stores numbers without country code).
    if (result.count === 0 && needsFallback) {
        Logger.info("[HOTPROSPECTOR] No result with full number, retrying with last 10 digits", {
            primaryPhone,
            last10,
        });
        const fallbackResult = await executeHPSearch(api_uId, api_key, GroupId, last10);
        Logger.info("[HOTPROSPECTOR] Fallback search result", {
            ok: fallbackResult.ok,
            count: fallbackResult.count,
            hasLead: !!fallbackResult.lead,
            leadId: fallbackResult.lead?.LeadId,
            leadName: fallbackResult.lead
                ? `${fallbackResult.lead.Firstname ?? ""} ${fallbackResult.lead.Lastname ?? ""}`.trim()
                : null,
        });
        return fallbackResult;
    }
    Logger.info("[HOTPROSPECTOR] Search result", {
        ok: result.ok,
        count: result.count,
        hasLead: !!result.lead,
        leadId: result.lead?.LeadId,
        leadName: result.lead
            ? `${result.lead.Firstname ?? ""} ${result.lead.Lastname ?? ""}`.trim()
            : null,
    });
    return result;
}
