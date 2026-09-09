import {
  GLYPH_DISC,
  GLYPH_TRIANGLE,
} from '@jbrowse/render-core/shaders/pointMarkConsts'

import type { Feature, Region } from '@jbrowse/core/util'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

// The per-feature glyph classes belong to render-core's `point` shape, whose
// pointMark.slang authors them once and `//! export-consts`es them (adr-051) —
// the shader's vertex branches, the Canvas2D painter and this worker all read
// the one definition. A SNP is the shape's disc; an insertion SV its triangle.

// Glyph for a feature outside LD mode. The LD evaluator falls back to this for
// every non-index SNP, so switching coloring modes can't silently flatten
// insertion SVs into plain discs — one definition, both paths.
export function defaultGlyph(feature: Feature) {
  return feature.get('svtype') === 'INS' ? GLYPH_TRIANGLE : GLYPH_DISC
}

export type ManhattanColorBy = 'normal' | 'ld' | 'field'

export interface GetManhattanDataArgs {
  adapterConfig: Record<string, unknown>
  region: Region
  // CSS color literal or jexl expression (`jexl:...`). Evaluated per feature
  // on the worker — the result baked into the payload's `color`. Used in
  // 'normal' coloring mode.
  color: string
  // 'ld' colors each point by its r² to `indexSnp`, read from `ldAdapterConfig`
  // (a PLINK .ld adapter). 'field' colors by the distinct values of
  // `colorField`. 'normal' uses `color`.
  colorBy: ManhattanColorBy
  colorField: string
  // The feature field plotted on the y axis, `score` unless the display's
  // `scoreField` slot names another
  scoreField: string
  // Index/lead SNP for LD coloring — a SNP id or `chr:bp` (1-based) string.
  indexSnp?: string
  // PLINK .ld adapter config snapshot resolved on the worker for LD coloring.
  ldAdapterConfig?: Record<string, unknown>
  // `region.refName` in the LD adapter's own naming scheme, resolved in
  // `serializeArguments`. The renaming pass every RPC gets only covers
  // `adapterConfig` — the GWAS file — and the PLINK file is a second adapter
  // free to spell the same contig differently, so it needs its own name.
  // Present only in LD coloring mode, where it is the only thing that reads it.
  ldRefName?: string
}

// Whether this request colors by LD. Three things have to be present, and both
// sides of the RPC boundary have to agree on all three: `serializeArguments`
// resolves `ldRefName` only when this holds, and the worker takes the LD path
// only when it holds. Stated once because the two readings drifting apart is
// silent — the worker would still read LD records, but with no `ldRefName`, so
// it would query the PLINK file under the GWAS file's name for the contig,
// which is exactly the bug `ldRefName` exists to fix.
// Generic in the argument type, rather than taking the three-field Pick
// directly, so narrowing it does not throw away the rest of the caller's
// object — the worker calls it on a bag that also carries `pluginManager` and
// the status/stop-token handles, and needs those to survive the guard.
export function ldColoringRequested<
  T extends Pick<
    GetManhattanDataArgs,
    'colorBy' | 'indexSnp' | 'ldAdapterConfig'
  >,
>(
  args: T,
): args is T & {
  indexSnp: string
  ldAdapterConfig: Record<string, unknown>
} {
  return (
    args.colorBy === 'ld' &&
    !!args.indexSnp &&
    args.ldAdapterConfig !== undefined
  )
}

/**
 * One region's worth of GWAS points: the encoder's channels — `y` the score,
 * `color` packed per feature under whichever coloring mode, `glyph` the
 * point shape's class, `scale` the value table under field coloring — plus
 * what LD coloring adds.
 */
export interface ManhattanRpcResult extends EncodedChannels {
  // LD mode only: per-feature r² to the index SNP (1 for the index itself,
  // NaN where the SNP has no LD record). Undefined in normal coloring mode,
  // so the bulk score payload stays compact for whole-genome views.
  r2s?: Float32Array
  // LD mode only: whether the index SNP appeared in this region's LD data.
  indexFound?: boolean
}
