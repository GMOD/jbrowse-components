// The collation both track selectors sort by. Digit runs compare as numbers, so
// `sample2` precedes `sample10` rather than sorting by code point — the two
// selectors list the same tracks, so they must not disagree on their order.
// Built once: localeCompare's options argument constructs a collator per call,
// which is the expensive part of sorting a few thousand rows.
export const trackNameCollator = new Intl.Collator(undefined, { numeric: true })
