// Guards the handful of places where a stored, user-typed value is rendered
// straight into an href.
//
// Fields like a call's transcript_url or a signal's source_url are free text
// — nothing stopped someone saving `javascript:...` and having it execute
// for the next person who clicked the link. React escapes element *content*
// automatically, but it does not police URL schemes in attributes, so this
// is the one XSS vector the app's otherwise-escaped rendering leaves open.
//
// Anything that isn't a well-formed http(s) URL returns null, and callers
// render plain text instead of a link.

const ALLOWED_PROTOCOLS = ["http:", "https:"];

/** Returns `url` if it's a safe http(s) link, otherwise null. */
export function safeUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    // Parsed rather than prefix-matched: `java\tscript:` and friends are
    // normalized by the URL parser, and a string comparison would miss them.
    const parsed = new URL(trimmed);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol) ? trimmed : null;
  } catch {
    // Not an absolute URL. These fields are meant to hold links to external
    // systems (Gong, Drive, a news article), so a bare relative path is
    // treated as unusable rather than resolved against our own origin.
    return null;
  }
}
