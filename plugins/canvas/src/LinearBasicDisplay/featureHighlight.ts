import type { FlatbushItem } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The fields any rendered item — top-level feature or subfeature — is matched on
type HighlightItem = Pick<FlatbushItem, 'startBp' | 'endBp' | 'name'>

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
  // Resolve against subfeatures (transcripts) only. Set by the right-click
  // "highlight this transcript" path, never by text search.
  //
  // A span alone cannot address a transcript: isoforms routinely share their
  // gene's exact span AND each other's — GFF3's canonical EDEN has gene,
  // EDEN.1 and EDEN.2 all spanning 1050..9000. Span-first matching would
  // resolve every one of them to the gene and box the whole locus. So a
  // subfeature-scoped highlight skips top-level features entirely and adds the
  // name as a REQUIRED exact match, which is the only thing telling EDEN.1 from
  // EDEN.2 apart. An unnamed subfeature falls back to span alone and so boxes
  // its same-span siblings too — nothing distinguishes them, and over-boxing
  // beats a menu entry that does nothing when clicked.
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

// The unscoped (text-search) rule: span-first, with an exact name rescuing an
// overlapping span that drifted.
function fuzzyMatches(item: HighlightItem, h: FeatureHighlight) {
  const overlaps = item.endBp > h.start && item.startBp < h.end
  return spanMatches(item, h) || (overlaps && nameMatches(item.name, h))
}

export function featureMatchesHighlight(
  item: HighlightItem,
  itemRefName: string,
  h: FeatureHighlight,
) {
  // a subfeature-scoped highlight never resolves to a top-level feature, even
  // when the spans coincide — that's the whole point of the scope
  return itemRefName === h.refName && !h.subfeature && fuzzyMatches(item, h)
}

// Does this rendered subfeature (transcript) match the highlight? Two callers
// with different needs:
//   - scoped (right-click) → span + the exact name, the only way to tell
//     same-span isoforms apart (span alone when the subfeature is unnamed).
//   - unscoped (text search) → the fuzzy fallback, for a searched transcript
//     whose span is a subspan of its gene, where the gene never matched.
export function subfeatureMatchesHighlight(
  item: HighlightItem,
  itemRefName: string,
  h: FeatureHighlight,
) {
  return (
    itemRefName === h.refName &&
    (h.subfeature
      ? spanMatches(item, h) && (h.name ? nameMatches(item.name, h) : true)
      : fuzzyMatches(item, h))
  )
}

// Would a stored highlight resolve to this target? Dispatches on the target's
// own scope, since the two resolve under different rules.
//
// Only addFeatureHighlightForItem's dedupe asks this — it's comparing a
// would-be signature against stored ones, before anything is rendered. Anything
// asking which highlights ALREADY box a rendered id must read the resolver's
// attribution (resolvedHighlights.boxedBy) instead: these matchers are
// heuristic, and outside the resolution loop they lose its topLevelMatched gate
// and answer for boxes that were never drawn.
export function targetMatchesHighlight(
  target: HighlightTarget,
  refName: string,
  h: FeatureHighlight,
) {
  return target.subfeature
    ? subfeatureMatchesHighlight(target, refName, h)
    : featureMatchesHighlight(target, refName, h)
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

// Resolve declarative highlights against the RAW fetched data (pre-layout, so
// it needs no row/topPx) rather than laid-out data. A highlight boxes the
// top-level feature when it matches, and falls back to boxing a subfeature
// when no top-level feature matched (e.g. a searched transcript whose span is
// a subspan of its gene, so it never matches the gene's full span). A
// subfeature-scoped highlight (right-click "highlight this transcript")
// matches no top-level feature by construction, so it always takes the
// subfeature path — that's how it addresses an isoform whose span equals its
// gene's:
//   `box` = the render-item ids the overlay draws a box around.
//   `pin` = the ids the packer pins to a top row. For a subfeature that's its
//           PARENT feature, since the packer keys on top-level ids and pinning
//           the subfeature id would be a no-op that leaves the searched
//           transcript buried/clipped in a dense track.
//   `boxedBy` = index-aligned with `highlights`: which ids each individual
//           highlight boxes. Attribution is the only honest answer to "which
//           highlights box THIS?" — the matchers are heuristic (trix records
//           no uniqueId, and its label may be a custom/indexed string), so
//           re-running one outside this resolution loop loses the
//           topLevelMatched gate and reports matches for things a highlight
//           never boxed. Fine for best-effort boxing, not for deciding what to
//           DELETE; see removeFeatureHighlightsForId.
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
        if (featureMatchesHighlight(item, data.refName, h)) {
          boxed.add(item.featureId)
          pin.add(item.featureId)
          topLevelMatched = true
        }
      }
      // Only fall back to boxing subfeatures when the top-level feature never
      // matched (e.g. a searched transcript whose span is a subspan of its
      // gene). If the gene itself matched, boxing its subfeatures too would
      // draw redundant sub-boxes inside the glyph.
      if (!topLevelMatched) {
        for (const s of data.subfeatureInfos) {
          if (
            subfeatureMatchesHighlight(
              { startBp: s.startBp, endBp: s.endBp, name: s.displayLabel },
              data.refName,
              h,
            )
          ) {
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
