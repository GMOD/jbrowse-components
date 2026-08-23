import { types } from '@jbrowse/mobx-state-tree'

import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

// The fields any rendered item — top-level feature or subfeature — is matched on
type HighlightItem = Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>

// A declarative request to highlight a feature, resolved against fetched
// features on the main thread so it survives pan/zoom/refetch. Right-click
// "Highlight feature" pins `featureId`, the only thing that tells two features
// apart when they share a name AND overlap in span. Text search never
// serializes the adapter's uniqueId, so it pins the exact span trix recorded.
export interface FeatureHighlight {
  refName: string
  // interbase (0-based half-open), matching FlatbushItem.startBp. Optional so a
  // highlight can be authored by name alone (`{refName: 'chr12', name: 'KRAS'}`)
  start?: number
  end?: number
  // Display value AND fallback matcher, used when the span or featureId
  // resolved to nothing
  name?: string
  // The rendered feature's reload-stable id. When present it is the SOLE
  // matcher — span and name are ignored.
  featureId?: string
}

// Persists FeatureHighlight in a session snapshot or URL.
export const FeatureHighlightModel = types.model('FeatureHighlight', {
  refName: types.string,
  start: types.maybe(types.number),
  end: types.maybe(types.number),
  name: types.maybe(types.string),
  featureId: types.maybe(types.string),
})

// Compile-time proof the model's snapshot and the plain interface stay
// structurally identical, checked both ways (the AssignableTo idiom from
// modelContract.ts). `setFeatureHighlights(cast(...))` silently drops any field
// the model lacks, so without this the next field added to either side is lost.
type AssignableTo<A extends B, B> = A
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _HighlightModelToInterface = AssignableTo<
  SnapshotIn<typeof FeatureHighlightModel>,
  FeatureHighlight
>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _HighlightInterfaceToModel = AssignableTo<
  FeatureHighlight,
  SnapshotIn<typeof FeatureHighlightModel>
>

// A rendered thing the user right-clicked: the exact id to highlight plus the
// span/name stored for display and search-highlight parity.
export interface HighlightTarget {
  startBp: number
  endBp: number
  name?: string
  featureId: string
}

// Exact span match within ±1bp for the 1-based↔interbase convention. The
// indexed span and the rendered feature's span both derive from the same true
// genomic coords (the worker never clips to the region), so exact is reliable.
// Deliberately no overlap fallback: a near-miss fails to highlight rather than
// boxing a same-named neighbour that happens to overlap. Reached only for
// highlights without a featureId.
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

// Fallback once the span/featureId pass boxed nothing anywhere. Exact name
// equality, case insensitive, scoped to the refName — it never widens a span,
// it only answers "you asked for the feature called X and no span matched".
// It can box more than one feature when a name is genuinely ambiguous (a gene
// and its same-named transcript); over-highlighting is visible and correctable,
// where the strict-only behaviour failed silently.
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

// What resolveFeatureHighlights needs from each fetched region — a structural
// subset of the model's LoadedFeatureData, kept local so this stays pure.
export interface HighlightableRegion {
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

// The loaded genomic span of one fetched region.
interface LoadedSpan {
  refName: string
  start: number
  end: number
}

// Whether "this highlight boxed nothing" is evidence of a bad spec rather than
// of the user looking elsewhere: only a highlight whose own span overlaps
// fetched data can be judged.
//
// A name-only highlight is never checkable — without a span, "not fetched yet"
// and "misspelled" are indistinguishable. Nor is a right-click one: its id came
// from a rendered feature, so resolving to nothing means the feature stopped
// being drawn (hidden, filtered, or an isoform the gene glyph dropped), all
// routine, and the warning would blame the user's coordinates for each.
function highlightIsCheckable(
  h: FeatureHighlight,
  loadedSpans: readonly LoadedSpan[],
) {
  const { refName, start, end } = h
  return (
    h.featureId === undefined &&
    start !== undefined &&
    end !== undefined &&
    loadedSpans.some(
      r => r.refName === refName && r.start < end && r.end > start,
    )
  )
}

// Once per span-authored highlight that resolved to nothing. Exact matching is
// right for the two programmatic provenances but a trap for the third — a
// hand-written session spec, where being a few bases off the track's own record
// is the normal mistake and the only symptom is that nothing draws.
//
// Module-level so the warning stays once-per-highlight across the many times the
// getter recomputes; exported reset so test cases don't depend on each other.
const warned = new Set<string>()

export function resetUnresolvedHighlightWarnings() {
  warned.clear()
}

export function warnUnresolvedHighlights(
  highlights: readonly FeatureHighlight[],
  resolved: ResolvedHighlights,
  loadedSpans: readonly LoadedSpan[],
) {
  for (const [i, h] of highlights.entries()) {
    if (
      resolved.boxedBy[i]?.size === 0 &&
      highlightIsCheckable(h, loadedSpans)
    ) {
      const key = `${h.refName}:${h.start}-${h.end}:${h.name ?? ''}`
      if (!warned.has(key)) {
        warned.add(key)
        console.warn(
          `featureHighlight matched no rendered feature: ` +
            `${h.refName}:${h.start}-${h.end}` +
            `${h.name ? ` (${h.name})` : ''}. A highlight matches a feature's span ` +
            `exactly (±1bp), falling back to an exact name match` +
            `${h.name ? '' : ' — but this one supplied no name'}.`,
        )
      }
    }
  }
}

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

// One matching sweep over every region for a single highlight: the ids it boxes
// plus the ids to pin (a subfeature pins its PARENT, since the packer keys on
// top-level ids). Shared by the span/featureId pass and the name fallback so
// both traverse regions and subfeatures by identical rules.
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
    // Subfeatures only when no top-level feature matched — boxing a matched
    // gene's subfeatures too draws redundant sub-boxes inside the glyph.
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

// Resolve declarative highlights against the RAW fetched data (pre-layout, so no
// row/topPx needed):
//   `box` = the render-item ids the overlay draws a box around.
//   `pin` = the ids the packer pins to a top row, and ONLY for a highlight that
//           named something the user cannot see. A right-click highlight marks a
//           feature the user just clicked; pinning it yanked it from row 78 to
//           row 0, reshuffled everything around it, and left it above a scrolled
//           viewport. A highlight MARKS; only a pin moves.
//   `boxedBy` = index-aligned with `highlights`: which ids each one boxes.
//           Re-running a matcher outside this loop loses the topLevelMatched
//           gate, which is fine for best-effort boxing but not for deciding what
//           to DELETE; see removeFeatureHighlightsForId.
export function resolveFeatureHighlights(
  regions: Iterable<HighlightableRegion>,
  highlights: readonly FeatureHighlight[],
): ResolvedHighlights {
  // Materialized once: `regions` is walked once per highlight, and a single-use
  // iterator (a Map's .values()) would be exhausted after the first.
  const regionList = [...regions]
  const box = new Set<string>()
  const pin = new Set<string>()
  const boxedBy = highlights.map(h => {
    let { boxed, pin: pins } = sweep(regionList, (item, featureId, refName) =>
      highlightHits(h, item, featureId, refName),
    )
    // Only if the exact pass boxed NOTHING anywhere, and never for a featureId
    // highlight — falling back to its name would box every same-named sibling,
    // the exact symptom storing the id fixed. Scoped whole-sweep rather than
    // per-region so a span match in one region can't also name-match something
    // unrelated in another.
    if (boxed.size === 0 && h.name !== undefined && h.featureId === undefined) {
      ;({ boxed, pin: pins } = sweep(regionList, (item, _featureId, refName) =>
        featureNameMatchesHighlight(item, refName, h),
      ))
    }
    for (const id of boxed) {
      box.add(id)
    }
    if (h.featureId === undefined) {
      for (const id of pins) {
        pin.add(id)
      }
    }
    return boxed
  })
  return { box, pin, boxedBy }
}
