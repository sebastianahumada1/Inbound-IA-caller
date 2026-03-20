/**
 * HotProspector API Client
 *
 * Reusable service for searching leads in HotProspector via their custom API.
 * Endpoint: POST https://hotprospector.com/glu/custom_api
 * Method  : SearchByUserInput
 */

import { Logger } from '../utils/logger.js';

// ────────────────────────────── Types ──────────────────────────────

export type HotProspectorCustomFields = {
  where_is_your_pain_located?: string | string[];
  have_you_had_an_mri?: string;
  is__custom_valuescity__a_reasonable_commute_for_you?: string;
  have_you_seen_a_doctor_for_your_pain_if_so_what_did_they_tell_you_?: string | string[];
  have_you_tried_procedures_or_treatments_for_your_pain?: string | string[];
  describe_your_symptoms_check_all_that_apply?: string | string[];
  are_you_currently_taking_medications_for_your_pain?: string;
  how_long_have_you_been_suffering_from_back_pain_disc_pain_or_sciatica?: string;
  back__neck_sop_link?: string;
  date?: string;
  call_count?: string;
  appointment_time?: string;
  appointment_date?: string;
  [key: string]: unknown; // allow other custom fields
};

export type HotProspectorLead = {
  LeadId?: string;
  GroupId?: string;
  Tags?: string;
  Firstname?: string;
  Lastname?: string;
  "E-Mail"?: string;
  Phone?: string;
  Mobile?: string;
  CountryCode?: string;
  Zipcode?: string;
  City?: string;
  State?: string;
  Address?: string;
  Company?: string;
  Website?: string;
  Lead_Custom_Fields?: HotProspectorCustomFields;
  LocationId?: string;
  [key: string]: unknown; // allow extra fields returned by HP
};

export type HotProspectorResponse = {
  response: "true" | "false" | boolean;
  Results?: HotProspectorLead[];
  message?: string;
};

export type HotProspectorSearchResult = {
  ok: boolean;
  count: number;
  lead: HotProspectorLead | null;
};

// ────────────────────────────── Helpers ─────────────────────────────

/** Strip everything that is not a digit. 
 * HP stores numbers as 10 digits (no country code) for US.
 */
function digitsOnly(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  
  // Always take the last 10 digits to ensure we match HP's format
  // regardless of whether a country code (like +1) was provided.
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  
  return digits;
}

// ────────────────────────── Main function ───────────────────────────

/**
 * Search HotProspector by phone number.
 *
 * @param inputPhone – any format (E.164, with spaces/dashes, etc.)
 * @returns `{ ok, count, lead }` where `lead` is the first result (or null)
 */
export async function hotProspectorSearchByPhone(
  inputPhone: string,
): Promise<HotProspectorSearchResult> {
  const api_uId = process.env.HP_API_UID;
  const api_key = process.env.HP_API_KEY;
  const GroupId = process.env.HP_GROUP_ID;
  const locationId = process.env.HP_LOCATION_ID; // optional, sent if present

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

  const phone = digitsOnly(inputPhone);

  Logger.info("[HOTPROSPECTOR] Searching by phone", {
    phoneDigits: phone,
    GroupId,
    hasLocationId: !!locationId,
  });

  const body: Record<string, string> = {
    api_uId,
    api_key,
    GroupId,
    searchField: "mobile",
    searchText: phone,
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
  // HP API wraps the response in an array: [{response, Results, message}]
  const data: HotProspectorResponse = Array.isArray(raw) ? raw[0] : raw;
  const results = Array.isArray(data?.Results) ? data.Results : [];

  const result: HotProspectorSearchResult = {
    ok: data?.response === "true" || data?.response === true,
    count: results.length,
    lead: results[0] ?? null,
  };

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
