// Shared HubSpot API client used by every module adapter that reads HubSpot
// (api/abm, api/sources, api/marketing, and the Demo Calls import panel —
// api/pipeline is database-backed and imports none of this). Handles auth, the search endpoints' 100-id batch cap, and the
// per-second rate limit shared across the whole HubSpot account.

const BASE_URL = "https://api.hubapi.com";

export class HubspotConfigError extends Error {}
export class HubspotScopeError extends Error {
  constructor(message, requiredScopes) {
    super(message);
    this.requiredScopes = requiredScopes;
  }
}

export function getToken() {
  const token = process.env.HUBSPOT_TOKEN;
  if (!token) {
    throw new HubspotConfigError("HUBSPOT_TOKEN environment variable is not set on this deployment.");
  }
  return token;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Authenticated fetch against the HubSpot API with 429 backoff and
 * scope-error detection. `path` is relative to https://api.hubapi.com.
 */
async function hubspotFetch(token, path, options = {}, attempt = 1) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 429 && attempt <= 3) {
    // HubSpot's per-second rate limit is shared across the whole account —
    // back off and retry rather than failing the page.
    const retryAfter = Number(res.headers.get("retry-after")) || 1.5;
    await sleep(retryAfter * 1000 * attempt);
    return hubspotFetch(token, path, options, attempt + 1);
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const requiredScopes = body?.errors?.[0]?.context?.requiredGranularScopes || [];
    throw new HubspotScopeError(
      requiredScopes.length
        ? `Missing HubSpot scope: add ${requiredScopes.join(" or ")} to the Private App, then retry.`
        : body.message || "HubSpot request forbidden (missing scope).",
      requiredScopes
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot request failed (${res.status}) for ${path}: ${text}`);
  }

  return res.json();
}

/** GET a HubSpot endpoint and return the parsed JSON body. */
export function hubspotGet(token, path) {
  return hubspotFetch(token, path, { method: "GET" });
}

async function hubspotSearchBatch(token, objectType, ids, properties) {
  const json = await hubspotFetch(token, `/crm/v3/objects/${objectType}/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "hs_object_id", operator: "IN", values: ids.map(String) }] }],
      properties,
      limit: 200,
    }),
  });
  return json.results || [];
}

/**
 * Search CRM objects (contacts, companies, deals, ...) by a known list of IDs,
 * batching in groups of 100 (the search endpoint's IN-filter cap) and pacing
 * requests to stay under the per-second rate limit.
 */
export async function hubspotSearch(token, objectType, ids, properties) {
  const batches = chunk(ids, 100);
  const results = [];
  for (let i = 0; i < batches.length; i++) {
    results.push(await hubspotSearchBatch(token, objectType, batches[i], properties));
    // Pace between batches, not after the last one — the trailing sleep was
    // a guaranteed 350ms added to every multi-batch call for nothing.
    if (i < batches.length - 1) await sleep(350);
  }
  return results.flat();
}

/**
 * Runs `fn` over `items` with at most `limit` in flight at once.
 *
 * The alternative shapes are both wrong for HubSpot: a plain `for...of` with
 * an await inside is one sequential round trip per item (an N+1 against a
 * 30s function limit), and Promise.all fires all N at once into a
 * per-second rate limit shared across the whole account. Results keep the
 * input order regardless of completion order.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const DEFAULT_MAX_SEARCH_PAGES = 20; // safety cap: 20 * 200 = 4000 records per call

/**
 * Search CRM objects with a filter (not a known ID list) and page through
 * every result via the `after` cursor, up to `maxPages`. Used by modules
 * like Pipeline and Lead Sources that don't have a fixed roster to search by
 * ID. The returned array also carries `.total` (the filter's true match
 * count, from HubSpot) and `.truncated` (true if `maxPages` cut it short) —
 * callers that page through a potentially large, unbounded result set (e.g.
 * every contact in the portal) should surface `.truncated` rather than
 * silently showing a partial result as if it were everything.
 */
export async function hubspotSearchAll(token, objectType, { filterGroups = [], properties = [], sorts, maxPages = DEFAULT_MAX_SEARCH_PAGES } = {}) {
  const results = [];
  let after;
  let total = 0;
  let truncated = false;
  for (let page = 0; page < maxPages; page++) {
    const json = await hubspotFetch(token, `/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      body: JSON.stringify({ filterGroups, properties, sorts, limit: 200, after }),
    });
    if (page === 0) total = json.total ?? 0;
    results.push(...(json.results || []));
    after = json.paging?.next?.after;
    if (!after) break;
    if (page === maxPages - 1) truncated = true;
    await sleep(150);
  }
  results.total = total;
  results.truncated = truncated;
  return results;
}

/**
 * Fetch associated-object IDs for a batch of `fromObjectType` records (e.g.
 * which calls/deals are associated with each contact), via the v4 batch
 * associations endpoint. Returns a Map<fromId, toId[]>.
 */
export async function hubspotBatchAssociations(token, fromObjectType, toObjectType, fromIds) {
  const map = new Map();
  let processed = 0;
  for (const batch of chunk(fromIds, 100)) {
    const json = await hubspotFetch(token, `/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/read`, {
      method: "POST",
      body: JSON.stringify({ inputs: batch.map((id) => ({ id: String(id) })) }),
    });
    for (const result of json.results || []) {
      map.set(String(result.from.id), (result.to || []).map((t) => t.toObjectId));
    }
    processed += batch.length;
    if (processed < fromIds.length) await sleep(350); // between batches only, not after the last
  }
  return map;
}

export { chunk, sleep };
