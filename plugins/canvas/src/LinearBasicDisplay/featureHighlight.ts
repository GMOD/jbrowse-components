import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The fields any rendered item — top-level feature or subfeature — is matched on
type HighlightItem = Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>

// A declarative request to highlight a feature. Two provenances, resolved
// differently:
//   - Right-click "Highlight feature" knows the exact rendered feature, so it
//     pins `featureId` — the same reload-stable id solo/hide/pin use — and
//     resolves by an exact id match. This is the only thing that can tell two
//     features apart when they share a name AND overlap in span (the bug span
//     matching caused: every same-named overlapping feature boxed at once).
//   - Text search (trix) never serializes the adapter's uniqueId, so it omits
//     featureId and pins the feature by what trix DOES record: the feature's
//     exact span plus its indexed name, resolved fuzzily (below).
// Either way it is resolved against fetched features on the main thread (see
// highlightedFeatureIdSet), so it survives pan/zoom/refetch.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open) genomic coords, matching FlatbushItem.startBp
  start: number
  end: number
  name?: string
  // The rendered feature's (or subfeature's) reload-stable id. Set by the
  // right-click path; absent for text-search highlights, which have no id to
  // pin. When present it is the sole matcher — span/name are ignored.
  featureId?: string
}

// A rendered thing the user right-clicked, carrying the exact id to highlight
// along with the span/name stored for display and search-highlight parity.
export interface HighlightTarget {
  startBp: number
  endBp: number
  name?: string
  featureId: string
}

// The reliable signal for a text-search highlight is the (refName, start, end)
// triple — trix records the feature's exact coords, so a near-exact span match
// resolves the common gene-search case on its own. `name` is only a best-effort
// tiebreaker: the text-search label can be an indexed description ("protein
// kinase") rather than the feature's Name, so it's used solely to RESCUE an
// overlapping span — never to reject an otherwise-good span match. A
// wrong/description label just falls back to span.
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

// The text-search rule: span-first, with an exact name rescuing an overlapping
// span. Only reached for highlights without a featureId — an exact-id
// (right-click) highlight is short-circuited in resolveFeatureHighlights before
// this runs, so it never depends on span/name at all.
function fuzzyMatches(item: HighlightItem, h: FeatureHighlight) {
  const overlaps = item.endBp > h.start && item.startBp < h.end
  return spanMatches(item, h) || (overlaps && nameMatches(item.name, h))
}

// Does a text-search highlight match this rendered feature or subfeature? The
// same fuzzy rule serves both: a top-level feature matched by its span, or a
// searched transcript whose span is a subspan of its gene (so the gene never
// matched), matched as a subfeature.
export function featureMatchesHighlight(
  item: HighlightItem,
  itemRefName: string,
  h: FeatureHighlight,
) {
  return itemRefName === h.refName && fuzzyMatches(item, h)
}

// The fields resolveFeatureHighlights needs from each fetched region — a
// structural subset of the model's LoadedFeatureData, kept local so this stays
// a pure function decoupled from the RPC-result shape.
interface HighlightableRegion {
  refName: string
  flatbushItems: readonly (HighlightItem & { featureId: string })[]
  subfeatureInfos: readonly {
    featureId: string
    parentFeatureId: string
    startBp: number
    endBp: number
    displayLabel?: string
  }[]
}

export interface ResolvedHighlights {
  box: ReadonlySet<string>
  pin: ReadonlySet<string>
  boxedBy: ReadonlySet<string>[]
}

// Does highlight `h` resolve to a rendered item? An exact-id (right-click)
// highlight matches by featureId alone — never span/name — so two features
// sharing a name and span no longer both box; only the clicked one does. A
// text-search highlight (no featureId) falls to the fuzzy span+name matcher.
function highlightHits(
  h: FeatureHighlight,
  item: HighlightItem,
  featureId: string,
  refName: string,
) {
  return h.featureId
    ? featureId === h.featureId
    : featureMatchesHighlight(item, refName, h)
}

// Resolve declarative highlights against the RAW fetched data (pre-layout, so
// it needs no row/topPx) rather than laid-out data. A highlight boxes the
// top-level feature when it matches, and falls back to boxing a subfeature when
// no top-level feature matched — a text search for a transcript whose span is a
// subspan of its gene, or a right-click directly on a subfeature:
//   `box` = the render-item ids the overlay draws a box around.
//   `pin` = the ids the packer pins to a top row. For a subfeature that's its
//           PARENT feature, since the packer keys on top-level ids and pinning
//           the subfeature id would be a no-op that leaves the searched
//           transcript buried/clipped in a dense track.
//   `boxedBy` = index-aligned with `highlights`: which ids each individual
//           highlight boxes. Attribution is the only honest answer to "which
//           highlights box THIS?" — a fuzzy matcher re-run outside this loop
//           loses the topLevelMatched gate and reports matches for things a
//           highlight never boxed. Fine for best-effort boxing, not for
//           deciding what to DELETE; see removeFeatureHighlightsForId.
export function resolveFeatureHighlights(
  regions: Iterable<HighlightableRegion>,
  highlights: readonly FeatureHighlight[],
): ResolvedHighlights {
  // Materialized once: `regions` is walked once per highlight below, and a
  // single-use iterator (e.g. a Map's .values()) would be exhausted after the
  // first highlight, silently starving every highlight after it.
  const regionList = [...regions]
  const box = new Set<string>()
  const pin = new Set<string>()
  const boxedBy = highlights.map(h => {
    const boxed = new Set<string>()
    for (const data of regionList) {
      let topLevelMatched = false
      for (const item of data.flatbushItems) {
        if (highlightHits(h, item, item.featureId, data.refName)) {
          boxed.add(item.featureId)
          pin.add(item.featureId)
          topLevelMatched = true
        }
      }
      // Only fall back to boxing subfeatures when the top-level feature never
      // matched; boxing a matched gene's subfeatures too would draw redundant
      // sub-boxes inside the glyph.
      if (!topLevelMatched) {
        for (const s of data.subfeatureInfos) {
          const item = {
            startBp: s.startBp,
            endBp: s.endBp,
            name: s.displayLabel,
          }
          if (highlightHits(h, item, s.featureId, data.refName)) {
            boxed.add(s.featureId)
            pin.add(s.parentFeatureId)
          }
        }
      }
    }
    for (const id of boxed) {
      box.add(id)
    }
    return boxed
  })
  return { box, pin, boxedBy }
}
