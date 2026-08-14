// A single frozen empty array, shared by every "no data yet" fallback.
//
// The pattern this replaces — `const leads = data?.leads || []` — allocates
// a new array on every render, which silently defeats every downstream
// useMemo/useEffect that depends on it: a fresh identity each time means the
// dependency comparison never matches and the memoized work reruns. On the
// Overview page that meant re-summarizing every pipeline and demo-call lead,
// and rebuilding the monthly trend, on every single render.
//
// Frozen so an accidental `.push()` onto the shared instance fails loudly in
// development instead of poisoning every other consumer.
export const EMPTY_ARRAY = Object.freeze([]);
