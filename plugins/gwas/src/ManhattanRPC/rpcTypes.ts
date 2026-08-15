import {
  GLYPH_INSERTION,
  GLYPH_POINT,
} from '../LinearManhattanDisplay/shaders/manhattan.consts.generated.ts'

import type { Feature, Region } from '@jbrowse/core/util'

// The per-feature glyph classes this file used to declare are manhattan.slang's
// now, generated into `shaders/manhattan.iface.generated.ts` by
// `pnpm gen:shaders` (adr-051) — the shader's vertex branches and every
// non-shader consumer read the one definition. They were previously restated
// here and pinned to the shader by a test that string-matched its source.

// Glyph for a feature outside LD mode. The LD evaluator falls back to this for
// every non-index SNP, so switching coloring modes can't silently flatten
// insertion SVs into plain discs — one definition, both paths.
export function defaultGlyph(feature: Feature) {
  return feature.get('svtype') === 'INS' ? GLYPH_INSERTION : GLYPH_POINT
}

// Default Manhattan point color. Single source of truth for the `color` config
// slot default (configSchemaFactory) and the worker's fallback for a jexl
// `color` expression that yields a non-string (makeColorEvaluator), so the two
// can't drift. Lives here rather than in configSchemaFactory so the worker can
// import it without pulling the wiggle config schema into the worker bundle.
export const DEFAULT_MANHATTAN_COLOR = '#0068d1'

export interface GetManhattanDataArgs {
  adapterConfig: Record<string, unknown>
  region: Region
  // CSS color literal or jexl expression (`jexl:...`). Evaluated per feature
  // on the worker — the result baked into ManhattanRpcResult.colors[]. Used in
  // 'normal' coloring mode.
  color: string
  // 'ld' colors each point by its r² to `indexSnp`, read from `ldAdapterConfig`
  // (a PLINK .ld adapter). 'normal' uses `color`.
  colorBy: 'normal' | 'ld'
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

// One region's worth of GWAS points. Flat by design — GWAS doesn't bin or
// split by sign like wiggle does.
export interface ManhattanRpcResult {
  positions: Uint32Array
  // Feature end (absolute genomic uint32). Equals positions+1 for point
  // features (SNPs, insertions); wider for ranged structural variants
  // (deletions, duplications), which renderers draw as a span rather than a
  // disc.
  ends: Uint32Array
  // Per-feature glyph class: 0 = point (SNP or non-insertion point → disc),
  // 1 = insertion (inverted triangle), 2 = LD index/lead SNP (diamond, 'ld'
  // coloring mode only). Ranged SVs draw as a bar based on their pixel width
  // regardless of this code, so only the point-marker shape is type-driven.
  glyphs: Uint8Array
  scores: Float32Array
  // Per-feature ABGR colors (uint32). Always populated, even when the user's
  // color config is a literal string — the executor resolves to ABGR
  // uniformly so renderers don't need to branch.
  colors: Uint32Array
  numFeatures: number
  scoreMin: number
  scoreMax: number
  // LD mode only: per-feature r² to the index SNP (1 for the index itself,
  // NaN where the SNP has no LD record). Undefined in normal coloring mode,
  // so the bulk score payload stays compact for whole-genome views.
  r2s?: Float32Array
  // Flatbush 2D R-tree index over (bp, score) for hit testing — built on the
  // worker, transferred zero-copy, wrapped on demand via Flatbush.from. Empty
  // when numFeatures === 0 (Flatbush rejects zero-item indexes).
  flatbushData: ArrayBuffer | undefined
  // LD mode only: whether the index SNP appeared in this region's LD data.
  // Undefined in normal coloring mode.
  indexFound?: boolean
}
