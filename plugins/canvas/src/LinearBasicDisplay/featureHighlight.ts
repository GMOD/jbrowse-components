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
//     featureId and pins the feature by the exact span trix records — the label
//     is stored for display but not matched on (see featureMatchesHighlight).
// Either way it is resolved against fetched features on the main thread (see
// highlightedFeatureIdSet), so it survives pan/zoom/refetch.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open) genomic coords, matching FlatbushItem.startBp.
  // Optional so a highlight can be authored by NAME alone
  // (`{ refName: 'chr12', name: 'KRAS' }`) — see the name matcher below.
  start?: number
  end?: number
  // The feature's label. Both a display value AND a fallback matcher, used when
  // the span (or featureId) resolved to nothing.
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

// A text-search highlight has no uniqueId to match on, so it resolves by the
// exact span trix recorded — within ±1bp for the 1-based↔interbase convention.
// The indexed span and the rendered feature's span both derive from the same
// true genomic coords (the worker never clips to the region), so exact match is
// reliable. There is deliberately no overlap or name fallback: a near-miss
// simply fails to highlight rather than boxing a same-named neighbor that
// happens to overlap. Reached only for highlights without a featureId — an
// exact-id (right-click) highlight is short-circuited in
// resolveFeatureHighlights before this runs.
export function featureMatchesHighlight(
  item: HighlightItem,
  itemRefName: string,
  h: FeatureHighlight,
) {
  return (
    h.start !== undefined &&
    h.end !== undefined &&
    itemRefName === h.refName &&
    Math.abs(item.startBp - h.start) <= 1 &&
    Math.abs(item.endBp - h.end) <= 1
  )
}

// Name matcher, used only as a FALLBACK once the span/featureId pass boxed
// nothing anywhere (see resolveFeatureHighlights). Exact name equality, case
// insensitive, scoped to the highlight's refName — deliberately NOT the old
// overlap rescue that was removed: that one loosened the SPAN and so could sweep
// in a same-named neighbour that merely overlapped. This never widens a span; it
// only answers "you asked for the feature called X and no span matched, here it
// is", which is what a hand-authored highlight means and what a search result
// falls back to when its index and the rendered track disagree.
//
// It can box more than one feature when a name is genuinely ambiguous (a gene
// and its same-named transcript). That is the intended trade: over-highlighting
// is visible and correctable, whereas the strict-only behaviour failed silently.
export function featureNameMatchesHighlight(
  item: HighlightItem,
  itemRefName: string,
  h: FeatureHighlight,
) {
  return (
    h.name !== undefined &&
    item.name !== undefined &&
    itemRefName === h.refName &&
    item.name.toLowerCase() === h.name.toLowerCase()
  )
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

// Warn once per highlight that resolved to nothing.
//
// Matching is exact by design (see featureMatchesHighlight), which is right for
// the two provenances that produce highlights programmatically: a right-click
// carries a featureId, and a trix search's indexed span cannot drift from the
// rendered one. It is a trap for the third, unlisted provenance — a HAND-WRITTEN
// session spec, where somebody types coordinates. There, being a few bases off
// the track's own record is the normal mistake, and the symptom is that nothing
// draws, with no hint as to why. (A docs figure sat with a dead highlight and a
// hand-tuned arrow annotation compensating for it until someone diffed the
// coordinates against the GFF.)
//
// Reaching here means BOTH the span/featureId pass and the name fallback missed,
// so either the coordinates are wrong and no `name` was supplied, or the name
// doesn't match any rendered feature on that refName.
const warned = new Set<string>()

export function warnUnresolvedHighlights(
  highlights: readonly FeatureHighlight[],
  resolved: ResolvedHighlights,
  hasData: boolean,
) {
  // before any data lands every highlight is trivially unresolved
  if (hasData) {
    for (const [i, h] of highlights.entries()) {
      if (resolved.boxedBy[i]?.size === 0) {
        const key = `${h.refName}:${h.start}-${h.end}:${h.featureId ?? h.name ?? ''}`
        if (!warned.has(key)) {
          warned.add(key)
          const span =
            h.start === undefined || h.end === undefined
              ? h.refName
              : `${h.refName}:${h.start}-${h.end}`
          console.warn(
            `featureHighlight matched no rendered feature: ${span}` +
              `${h.name ? ` (${h.name})` : ''}. A highlight matches a feature's span ` +
              `exactly (±1bp), falling back to an exact name match` +
              `${h.name ? '' : ' — but this one supplied no name'}.`,
          )
        }
      }
    }
  }
}

// Does highlight `h` resolve to a rendered item? An exact-id (right-click)
// highlight matches by featureId alone — never span — so two features sharing a
// name and span no longer both box; only the clicked one does. A text-search
// highlight (no featureId) falls to the exact-span matcher.
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

// One matching sweep over every region for a single highlight. Returns the ids
// it boxes plus the ids to pin (a subfeature pins its PARENT, since the packer
// keys on top-level ids). Factored out so the span/featureId pass and the name
// fallback pass share identical region/subfeature traversal rules.
function sweep(
  regionList: HighlightableRegion[],
  matches: (item: HighlightItem, featureId: string, refName: string) => boolean,
) {
  const boxed = new Set<string>()
  const pin = new Set<string>()
  for (const data of regionList) {
    let topLevelMatched = false
    for (const item of data.flatbushItems) {
      if (matches(item, item.featureId, data.refName)) {
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
        if (matches(item, s.featureId, data.refName)) {
          boxed.add(s.featureId)
          pin.add(s.parentFeatureId)
        }
      }
    }
  }
  return { boxed, pin }
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
//           highlights box THIS?" — a span matcher re-run outside this loop
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
    // Pass 1: the exact matcher (featureId, else span). Unchanged behaviour —
    // anything that resolves today still resolves here, by the same rule.
    let { boxed, pin: pins } = sweep(regionList, (item, featureId, refName) =>
      highlightHits(h, item, featureId, refName),
    )
    // Pass 2: only if pass 1 boxed NOTHING anywhere, try the name. Scoped this
    // way (whole-sweep, not per-region) so a highlight whose span matches in one
    // region can't also name-match something unrelated in another.
    //
    // Never for a featureId highlight. That id comes from a right-click on one
    // specific rendered feature, and falling back to its name would box every
    // same-named sibling — the exact symptom "highlight only the right-clicked
    // feature, not same-named overlaps" fixed by storing the id in the first
    // place. If the id goes stale the honest result is no box, not the wrong
    // ones. The fallback is for highlights that never had an id to begin with:
    // hand-authored specs and text-search results.
    if (boxed.size === 0 && h.name !== undefined && h.featureId === undefined) {
      ;({ boxed, pin: pins } = sweep(regionList, (item, _featureId, refName) =>
        featureNameMatchesHighlight(item, refName, h),
      ))
    }
    for (const id of boxed) {
      box.add(id)
    }
    for (const id of pins) {
      pin.add(id)
    }
    return boxed
  })
  return { box, pin, boxedBy }
}
