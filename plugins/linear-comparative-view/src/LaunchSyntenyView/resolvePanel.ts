import { parseCigar2 } from '@jbrowse/cigar-utils'

import { getCigar, getMate } from '../syntenyMate.ts'
import { findPosInCigar } from './findPosInCigar.ts'

import type { SyntenyMate } from '../syntenyMate.ts'
import type { Feature } from '@jbrowse/core/util'

// The clicked block's genomic span, used to clip the launched synteny view to
// the region of interest. Only the span matters — the refName is the feature's
// by construction (the block is the one the feature was drawn in).
export interface RegionOfInterest {
  start: number
  end: number
}

/**
 * One panel of a launched synteny view: where it opens on its own assembly, and
 * the slice of the anchor axis it was cut from.
 *
 * **This, not the alignments behind it, is what the launch runs on.** The
 * resolution is a CIGAR walk per block, and the region launch does it in the
 * worker beside the fetch (see executeDiscoverMates) — so what crosses the RPC
 * boundary is a handful of numbers per panel rather than every block's CIGAR,
 * whose size is unbounded: a whole-chromosome launch against an HSP table is
 * tens of thousands of blocks, and an asm5 PAF block's `cg` tag alone runs to
 * 100 KB.
 */
export interface ResolvedPanel {
  assemblyName: string
  refName: string
  // the slice of the anchor axis this panel's alignments cover
  anchorStart: number
  anchorEnd: number
  mateStart: number
  mateEnd: number
  // the strand the panel opens on, which is the one carrying most of the
  // alignment rather than whichever block happened to come first
  reversed: boolean
}

// Given a CIGAR-walked offset `mateX` along the mate axis, place it back on
// genomic coordinates. The mate's genomic span is mate.start..mate.end. For
// forward-strand alignments we walk forward from mate.start; for reverse
// strand we walk backward from mate.end. `strand === undefined` is treated as
// forward (avoids `* 0` zeroing out the offset).
function mateOffsetToGenomic(
  mate: Pick<SyntenyMate, 'start' | 'end'>,
  mateOffset: number,
  strand: number | undefined,
) {
  return strand === -1 ? mate.end - mateOffset : mate.start + mateOffset
}

// The two spans one alignment contributes: its slice of the anchor axis and the
// matching slice of its mate. Without a region of interest the whole block is
// used; with one, both sides are narrowed to the slice the user asked for — the
// feature axis directly, the mate axis by walking the CIGAR.
//
// Offsets past either end of the CIGAR are capped by findPosInCigar, and a
// region starting left of the feature yields a negative offset that breaks the
// walk immediately, so the result is always clipped to the block without needing
// an explicit intersection.
//
// **An alignment with no CIGAR is still clipped**, by interpolating across the
// block instead of walking it. That is not a lesser approximation of the walk —
// it is exactly the geometry such a block is *drawn* with: no per-base
// correspondence is known, so the ribbon is a straight quadrilateral between the
// two blocks' corners, and reading the mate position off that straight edge is
// the same answer the picture gives. CIGAR-less blocks are the common case, not
// an edge one: a PAF from minimap2 without `-c` carries no `cg` tag, and neither
// do MashMap, MCScan or the coarse PIF tier. Framing every panel on the whole
// block instead meant a rubberband over one gene of a megabase-long asm5 block
// opened the whole megabase, on both sides, with no sign the selection had been
// ignored.
function resolveSpans({
  feature,
  mate,
  region,
}: {
  feature: Feature
  mate: SyntenyMate
  region: RegionOfInterest | undefined
}) {
  const cigar = getCigar(feature)
  const strand = feature.get('strand')
  const featStart = feature.get('start')
  const featEnd = feature.get('end')
  if (!region) {
    return {
      featStart,
      featEnd,
      mateStart: mate.start,
      mateEnd: mate.end,
    }
  }
  if (cigar) {
    const p = parseCigar2(cigar)
    const [fStartX, mStartX] = findPosInCigar(p, region.start - featStart)
    const [fEndX, mEndX] = findPosInCigar(p, region.end - featStart)
    return {
      featStart: featStart + fStartX,
      featEnd: featStart + fEndX,
      mateStart: mateOffsetToGenomic(mate, mStartX, strand),
      mateEnd: mateOffsetToGenomic(mate, mEndX, strand),
    }
  }
  // clamped to the block first, so a selection wider than the alignment (or
  // starting left of it) lands back on the block's own ends rather than
  // extrapolating off either side of the mate
  const clamp = (x: number) => Math.min(Math.max(x, featStart), featEnd)
  const lo = clamp(region.start)
  const hi = clamp(region.end)
  const featLen = featEnd - featStart
  const mateLen = mate.end - mate.start
  // a zero-length block has no interior to interpolate across; both ends map to
  // the mate's own start, which paddedLocString widens to one base
  const mateOffset = (x: number) =>
    featLen > 0 ? ((x - featStart) / featLen) * mateLen : 0
  return {
    featStart: lo,
    featEnd: hi,
    mateStart: mateOffsetToGenomic(mate, mateOffset(lo), strand),
    mateEnd: mateOffsetToGenomic(mate, mateOffset(hi), strand),
  }
}

/**
 * Where one panel will open, before window padding — the resolution the launch
 * itself runs on, so the region dialog's panel list previews the view it is
 * about to build instead of restating the blocks behind it.
 *
 * ALL of the panel's alignments, unioned, not just the widest of them. A
 * selection routinely covers several blocks of one mate: an HSP table (BLAST
 * tabular) and a gene-anchor table (MCScan) are one row per *hit*, so a
 * kilobase-scale locus is already dozens of them, and even a minimap2 PAF splits
 * at every structural difference. Framing the panel on one of those blocks
 * opened a fraction of what the user selected, on both axes, and dropped the
 * rest with nothing on screen to say so.
 *
 * Two rules keep that union bounded, and both are "a panel opens on one stable
 * sequence": the mate CONTIG covering most of the anchor axis wins and the rest
 * are dropped, rather than unioning into a span covering neither; and the panel
 * is reversed only when the minus strand carries most of the alignment.
 *
 * `undefined` when nothing in `features` has a mate, which is not a panel.
 */
export function resolvePanel(
  features: Feature[],
  region: RegionOfInterest | undefined,
): ResolvedPanel | undefined {
  const resolved = features.flatMap(feature => {
    const mate = getMate(feature)
    return mate
      ? [{ feature, mate, spans: resolveSpans({ feature, mate, region }) }]
      : []
  })
  const bpByRefName = new Map<string, number>()
  for (const { mate, spans } of resolved) {
    const bp = spans.featEnd - spans.featStart
    bpByRefName.set(mate.refName, (bpByRefName.get(mate.refName) ?? 0) + bp)
  }
  const refName = [...bpByRefName].sort((a, b) => b[1] - a[1])[0]?.[0]
  // ONE LOOP, AND NO SPREAD INTO Math.min. `Math.min(...blocks)` throws
  // `RangeError: Maximum call stack size exceeded` past ~125k arguments, and the
  // mate ends alone are two per block — so ~62k blocks on the winning contig
  // took the discovery worker out with a stack overflow reported as a failed RPC.
  // That is inside the range this function is written for: the fetch behind
  // `executeDiscoverMates` is uncapped, a whole-chromosome launch is what the
  // visible-region entry exists for, and an HSP or gene-anchor table is one row
  // per hit.
  let assemblyName: string | undefined
  let anchorLo = Number.POSITIVE_INFINITY
  let anchorHi = Number.NEGATIVE_INFINITY
  let mateLo = Number.POSITIVE_INFINITY
  let mateHi = Number.NEGATIVE_INFINITY
  let minusBp = 0
  let totalBp = 0
  for (const { feature, mate, spans } of resolved) {
    if (mate.refName === refName) {
      const { featStart, featEnd, mateStart, mateEnd } = spans
      assemblyName ??= mate.assemblyName
      anchorLo = Math.min(anchorLo, featStart)
      anchorHi = Math.max(anchorHi, featEnd)
      // a reverse-strand walk counts down, so one block's two ends arrive
      // swapped
      mateLo = Math.min(mateLo, mateStart, mateEnd)
      mateHi = Math.max(mateHi, mateStart, mateEnd)
      const bp = featEnd - featStart
      totalBp += bp
      if (feature.get('strand') === -1) {
        minusBp += bp
      }
    }
  }
  // Whole bases, rounded OUTWARD, and here rather than at either of the two
  // places that read these: interpolating across a block lands on a fraction of
  // a base, and so does walking a CIGAR from a viewport edge. Rounding in only
  // meant the dialog previewed a span the launched view then opened a base short
  // of, and the dialog and the launch each rounded for themselves.
  return refName === undefined || assemblyName === undefined
    ? undefined
    : {
        assemblyName,
        refName,
        anchorStart: Math.floor(anchorLo),
        anchorEnd: Math.ceil(anchorHi),
        mateStart: Math.floor(mateLo),
        mateEnd: Math.ceil(mateHi),
        // ties (a single zero-length block, an even split) read as forward,
        // which is what an unflipped panel already was
        reversed: minusBp * 2 > totalBp,
      }
}

/**
 * The panels a set of alignments launches as: one per mate assembly, in the
 * order each first appears.
 *
 * For the launches that hold Features rather than a discovery result — the
 * pairwise right-click, the feature-detail link. The region launch's panels are
 * resolved in the worker instead (`pickMatesForRegion`), which is the same
 * grouping over the same `resolvePanel`.
 */
export function resolveFeaturePanels(
  features: Feature[],
  region: RegionOfInterest | undefined,
): ResolvedPanel[] {
  const groups = new Map<string, Feature[]>()
  for (const feature of features) {
    const assemblyName = getMate(feature)?.assemblyName
    if (assemblyName === undefined) {
      throw new Error('Alignment has no mate to launch a synteny view against')
    }
    const group = groups.get(assemblyName)
    if (group) {
      group.push(feature)
    } else {
      groups.set(assemblyName, [feature])
    }
  }
  return [...groups.values()].flatMap(group => {
    const panel = resolvePanel(group, region)
    return panel ? [panel] : []
  })
}

/**
 * The slice of the ANCHOR axis a set of panels covers, or `undefined` for none.
 *
 * Every panel is clipped to the same region of interest, so the anchor row spans
 * the union of what the panels resolved to — one mate's CIGAR can stop short of
 * the region where another's covers it, which is why this is not just the region.
 *
 * Shared because the launch and its dialog both need exactly this and have to
 * agree: `buildSyntenyViewSpec` frames the anchor panel on it and the dialog's
 * panel list previews it, so two spellings meant the row said one span and the
 * launched view opened another. The agreement used to be a comment in both.
 */
export function anchorSpanOfPanels(panels: ResolvedPanel[]) {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const panel of panels) {
    start = Math.min(start, panel.anchorStart)
    end = Math.max(end, panel.anchorEnd)
  }
  return panels.length ? { start, end } : undefined
}

/**
 * The mate side of a single alignment, for the callers that follow one block
 * rather than build a panel out of several — see `matePanelSpan`.
 */
export function resolvedMateSpan(
  feature: Feature,
  region: RegionOfInterest | undefined,
) {
  const panel = resolvePanel([feature], region)
  return panel
    ? {
        refName: panel.refName,
        start: panel.mateStart,
        end: panel.mateEnd,
        reversed: panel.reversed,
      }
    : undefined
}
