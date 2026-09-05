import { types } from '@jbrowse/mobx-state-tree'

import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

type HighlightItem = Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>

export interface FeatureHighlight {
  refName: string
  // Interbase, matching FlatbushItem.startBp; optional so a highlight can be
  // authored by name alone.
  start?: number
  end?: number
  name?: string
  // When present it is the sole matcher; span and name are ignored.
  featureId?: string
}

export const FeatureHighlightModel = types.model('FeatureHighlight', {
  refName: types.string,
  start: types.maybe(types.number),
  end: types.maybe(types.number),
  name: types.maybe(types.string),
  featureId: types.maybe(types.string),
})

// `setFeatureHighlights(cast(...))` silently drops any field the model lacks,
// so the model's snapshot and the interface are checked against each other
// both ways.
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

export interface HighlightTarget {
  startBp: number
  endBp: number
  name?: string
  featureId: string
}

// Exact within ±1bp for the 1-based/interbase convention, with no overlap
// fallback: a near-miss fails rather than boxing a same-named overlapping
// neighbour.
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

// Runs only once the span/featureId pass boxed nothing anywhere; it may box a
// gene and its same-named transcript, which is visible and correctable where
// a silent miss was not.
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

interface LoadedSpan {
  refName: string
  start: number
  end: number
}

// A name-only highlight is never checkable (not fetched yet and misspelled
// look the same), nor is a right-click one, whose feature stopping being
// drawn is routine.
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

// Module-level so the warning stays once per highlight across getter
// recomputes.
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

// A subfeature pins its parent, since the packer keys on top-level ids.
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
    // Subfeatures only when no top-level feature matched, or a matched gene
    // gets redundant sub-boxes inside its glyph.
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

// `pin` holds ids only for a highlight that named something the user cannot
// see: pinning a right-clicked feature yanked it from row 78 to row 0 and
// left it above a scrolled viewport. `boxedBy` is index-aligned with
// `highlights` and is what `removeFeatureHighlightsForId` deletes by.
export function resolveFeatureHighlights(
  regions: Iterable<HighlightableRegion>,
  highlights: readonly FeatureHighlight[],
): ResolvedHighlights {
  // Materialized once: `regions` is walked once per highlight, and a Map's
  // `.values()` is exhausted after the first.
  const regionList = [...regions]
  const box = new Set<string>()
  const pin = new Set<string>()
  const boxedBy = highlights.map(h => {
    const exact = sweep(regionList, (item, featureId, refName) =>
      highlightHits(h, item, featureId, refName),
    )
    // The name fallback runs only when the exact pass boxed nothing anywhere,
    // and never for a featureId highlight, whose name would box every
    // same-named sibling.
    const { boxed, pin: pins } =
      exact.boxed.size === 0 &&
      h.name !== undefined &&
      h.featureId === undefined
        ? sweep(regionList, (item, _featureId, refName) =>
            featureNameMatchesHighlight(item, refName, h),
          )
        : exact
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
