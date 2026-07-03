import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'

// A declarative request to highlight a feature by its identity signature rather
// than by its internal uniqueId. Text search (trix) never serializes the
// adapter's uniqueId, and that id is synthetic/unstable anyway (file offset or
// array index), so we pin the feature down by what trix DOES record: the
// feature's exact span plus its indexed name. Resolved against rendered
// features on the main thread (see highlightedFeatureIdSet), so it survives
// pan/zoom/refetch without ever needing the uniqueId.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open) genomic coords, matching FlatbushItem.startBp
  start: number
  end: number
  name?: string
}

// A rendered feature matches a request when its span is (nearly) identical to
// the recorded span, OR when it overlaps and shares the recorded name. The span
// test alone resolves the common gene-search case (trix records the gene's
// exact coords); the name+overlap test rescues records whose span drifted from
// the top-level feature (e.g. a transcript indexed under its gene) or whose
// coords differ by one from adapter base conventions.
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
