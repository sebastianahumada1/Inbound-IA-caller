/**
 * HotProspector API Client
 *
 * Reusable service for searching leads in HotProspector via their custom API.
 * Endpoint: POST https://hotprospector.com/glu/custom_api
 * Method  : SearchByUserInput
 */
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
    [key: string]: unknown;
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
    [key: string]: unknown;
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
/**
 * Search HotProspector by phone number.
 *
 * @param inputPhone – any format (E.164, with spaces/dashes, etc.)
 * @returns `{ ok, count, lead }` where `lead` is the first result (or null)
 */
export declare function hotProspectorSearchByPhone(inputPhone: string): Promise<HotProspectorSearchResult>;
