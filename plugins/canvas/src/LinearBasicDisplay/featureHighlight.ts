import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'

// A declarative request to highlight a feature by its identity signature rather
// than by its internal uniqueId. Text search (trix) never serializes the
// adapter's uniqueId, and that id is synthetic/unstable anyway (file offset or
// array index), so we pin the feature down by what trix DOES record: the
// feature's exact span plus its indexed name. Resolved against fetched features
// on the main thread (see highlightedFeatureIdSet), so it survives
// pan/zoom/refetch without ever needing the uniqueId.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open) genomic coords, matching FlatbushItem.startBp
  start: number
  end: number
  name?: string
  // Resolve against subfeatures (transcripts) only, keyed on an exact name
  // match. Set by the right-click "highlight this transcript" path, never by
  // text search.
  //
  // A span alone cannot address a transcript: isoforms routinely share their
  // gene's exact span AND each other's — GFF3's canonical EDEN has gene,
  // EDEN.1 and EDEN.2 all spanning 1050..9000. Span-first matching would
  // resolve every one of them to the gene and box the whole locus. So a
  // subfeature-scoped highlight skips top-level features entirely and requires
  // the name to match exactly, which is the only thing telling EDEN.1 from
  // EDEN.2 apart.
  subfeature?: boolean
}

// A rendered thing the user acted on, normalized to the fields that identify it.
// `subfeature` distinguishes a transcript from a top-level feature, since the
// two resolve under different rules.
export interface HighlightTarget {
  startBp: number
  endBp: number
  name?: string
  subfeature?: boolean
}

// The reliable signal is the (refName, start, end) triple — trix records the
// feature's exact coords, so a near-exact span match resolves the common
// gene-search case on its own. `name` is only a best-effort tiebreaker: the
// text-search label can be an indexed description ("protein kinase") rather than
// the feature's Name, so it's used solely to RESCUE an overlapping span that
// drifted (e.g. a transcript indexed under its gene) — never to reject an
// otherwise-good span match. A wrong/description label just falls back to span.
function spanMatches(
  item: Pick<FlatbushItem, 'startBp' | 'endBp'>,
  h: FeatureHighlight,
) {
  return (
    Math.abs(item.startBp - h.start) <= 1 && Math.abs(item.endBp - h.end) <= 1
  )
}

function nameMatches(name: string | undefined, h: FeatureHighlight) {
  return !!h.name && !!name && name.toLowerCase() === h.name.toLowerCase()
}

export function featureMatchesHighlight(
  item: Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>,
  itemRefName: string,
  h: FeatureHighlight,
) {
  // a subfeature-scoped highlight never resolves to a top-level feature, even
  // when the spans coincide — that's the whole point of the scope
  if (itemRefName !== h.refName || h.subfeature) {
    return false
  }
  const overlaps = item.endBp > h.start && item.startBp < h.end
  return spanMatches(item, h) || (overlaps && nameMatches(item.name, h))
}

// Does this rendered subfeature (transcript) match the highlight? Two callers
// with different needs:
//   - scoped (right-click) → exact name + span, the only way to tell same-span
//     isoforms apart.
//   - unscoped (text search) → the fuzzy fallback, for a searched transcript
//     whose span is a subspan of its gene, where the gene never matched.
export function subfeatureMatchesHighlight(
  item: { startBp: number; endBp: number; name?: string },
  itemRefName: string,
  h: FeatureHighlight,
) {
  if (itemRefName !== h.refName) {
    return false
  }
  const overlaps = item.endBp > h.start && item.startBp < h.end
  return h.subfeature
    ? spanMatches(item, h) && (h.name ? nameMatches(item.name, h) : true)
    : spanMatches(item, h) || (overlaps && nameMatches(item.name, h))
}

// Does a stored highlight resolve to this rendered target? Dispatches on the
// target's own scope so the menu's toggle/remove agrees with what the overlay
// actually boxed.
export function targetMatchesHighlight(
  target: HighlightTarget,
  refName: string,
  h: FeatureHighlight,
) {
  return target.subfeature
    ? subfeatureMatchesHighlight(target, refName, h)
    : featureMatchesHighlight(target, refName, h)
}
