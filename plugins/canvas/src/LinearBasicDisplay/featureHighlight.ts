import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'

// A declarative request to highlight a feature by its identity signature rather
// than by its internal uniqueId. Text search (trix) never serializes the
// adapter's uniqueId, and that id is synthetic/unstable anyway (file offset or
// array index), so we pin the feature down by what trix DOES record: the
// feature's exact span plus its indexed name. Resolved against rendered
// features on the main thread (see highlightedFeatureIds), so it survives
// pan/zoom/refetch without ever needing the uniqueId.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open) genomic coords, matching FlatbushItem.startBp
  start: number
  end: number
  name?: string
}

// The reliable signal is the (refName, start, end) triple — trix records the
// feature's exact coords, so a near-exact span match resolves the common
// gene-search case on its own. `name` is only a best-effort tiebreaker: the
// text-search label can be an indexed description ("protein kinase") rather than
// the feature's Name, so it's used solely to RESCUE an overlapping span that
// drifted (e.g. a transcript indexed under its gene) — never to reject an
// otherwise-good span match. A wrong/description label just falls back to span.
export function featureMatchesHighlight(
  item: Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>,
  itemRefName: string,
  h: FeatureHighlight,
) {
  if (itemRefName !== h.refName) {
    return false
  }
  const spanMatches =
    Math.abs(item.startBp - h.start) <= 1 && Math.abs(item.endBp - h.end) <= 1
  const overlaps = item.endBp > h.start && item.startBp < h.end
  const nameMatches =
    !!h.name && !!item.name && item.name.toLowerCase() === h.name.toLowerCase()
  return spanMatches || (overlaps && nameMatches)
}
