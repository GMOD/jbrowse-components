import { FACET_LABELS } from './facetLabels.ts'

import type {
  BaseLayer,
  ColorSchemeType,
  ReadColorBy,
  BodyScheme,
} from './types.ts'

export type ColorGroup = 'basic' | 'pairedEnd'

// Menu placement for a color scheme. Discriminated so a scheme is either a plain
// radio (shown in the 'basic' top-level list or the 'pairedEnd' submenu) or
// 'special' — driven by its own dialog/submenu (tag, modifications, bisulfite).
export type ColorSchemeMenu =
  | { kind: 'radio'; label: string; group: ColorGroup }
  | { kind: 'special'; label: string }

export interface ColorSchemeDef {
  type: ColorSchemeType
  bodyScheme: BodyScheme
  menu: ColorSchemeMenu
  // Color depends on the read's MATE (insert size / pair orientation), so an
  // unmapped mate (tlen=0) or inter-chromosomal mate is a level of its own
  // rather than a misleading insert/orientation hue (`overrideCategory`).
  mateAware?: boolean
  // The field reads how a read sits in its fragment, so in a chain the split
  // junction kinds and an unpaired segment's strand against its molecule's
  // are levels of it too (`overrideCategory`).
  orientation?: boolean
  // The worker emits one entry per ALIGNED BASE of every read for this scheme,
  // rather than one per event: the two walls this pipeline paints. Every other
  // scheme's worker output is sparse in the reads' bases, so these are the only
  // two whose extract is sampled at `subPixelBinBp` (see `perBaseBinBp` on the
  // display, which is the only reader).
  perBase?: boolean
  // The worker extracts different DATA for this scheme — per-base arrays,
  // modification marks, per-read tag strings, a reference-sequence fetch. Every
  // other scheme is decided entirely in the shader from arrays the worker always
  // produces, so switching between those must not refetch: `workerColorBy`
  // collapses them to one value, keeping `rpcProps` (and therefore the fetched
  // data) identical across the switch. Under-declaring this renders stale data,
  // so a new scheme's flag is asserted against what the worker actually reads —
  // see workerColorBy.test.ts.
  workerExtracts?: boolean
}

// Single registry of color-by schemes, keyed by ColorSchemeType. Adding a scheme
// to the union is a compile error until it is classified here with BOTH a shader
// path and a menu placement, so a scheme can no longer be half-wired — the bug
// the two old parallel maps (a shader-index map in the model, a menu-placement
// map in colorBy.ts) allowed, where a new scheme could get a shader index yet
// silently never appear in any menu. Insertion order is the menu order
// (Object.values preserves it), so the derived radio lists need no re-sorting.
export const COLOR_SCHEMES: Record<ColorSchemeType, ColorSchemeDef> = {
  normal: {
    type: 'normal',
    bodyScheme: 'normal',
    menu: { kind: 'radio', label: 'Normal', group: 'basic' },
  },
  strand: {
    type: 'strand',
    bodyScheme: 'strand',
    menu: { kind: 'radio', label: FACET_LABELS.strand, group: 'basic' },
  },
  mappingQuality: {
    type: 'mappingQuality',
    bodyScheme: 'mappingQuality',
    menu: { kind: 'radio', label: FACET_LABELS.mapq, group: 'basic' },
  },
  perBaseQuality: {
    type: 'perBaseQuality',
    // per-base overlay paints colored rects on top of a neutral 'normal' body
    bodyScheme: 'normal',
    menu: { kind: 'radio', label: 'Per-base quality', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  perBaseLetter: {
    type: 'perBaseLetter',
    // like perBaseQuality: nucleotide quads paint over the 'normal' body
    bodyScheme: 'normal',
    menu: { kind: 'radio', label: 'Per-base lettering', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  insertSize: {
    type: 'insertSize',
    bodyScheme: 'insertSize',
    menu: { kind: 'radio', label: 'Insert size', group: 'pairedEnd' },
    mateAware: true,
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    bodyScheme: 'firstOfPairStrand',
    menu: {
      kind: 'radio',
      label: FACET_LABELS.firstOfPairStrand,
      group: 'pairedEnd',
    },
  },
  pairOrientation: {
    type: 'pairOrientation',
    bodyScheme: 'pairOrientation',
    menu: {
      kind: 'radio',
      label: FACET_LABELS.pairOrientation,
      group: 'pairedEnd',
    },
    mateAware: true,
    orientation: true,
  },
  insertSizeAndOrientation: {
    type: 'insertSizeAndOrientation',
    bodyScheme: 'insertSizeAndOrientation',
    menu: {
      kind: 'radio',
      label: 'Insert size and orientation',
      group: 'pairedEnd',
    },
    mateAware: true,
    orientation: true,
  },
  tag: {
    type: 'tag',
    bodyScheme: 'tag',
    menu: { kind: 'special', label: 'Tag' },
    workerExtracts: true,
  },
  // Chromosome painting: color by the name of whatever this feature aligns TO —
  // a read's RNEXT, a PAF block's query contig — matching the synteny view's
  // 'query' mode. Both go through core's `refNameColor`, so one contig paints
  // the same color in both views: by position in the assembly's own chromosome
  // order, hashed only where that order is unknown. Rides the 'tag' shader path
  // — the color is baked per-read on the CPU either way.
  //
  // In the 'pairedEnd' group because on a BAM the name it paints is the MATE's
  // reference (`getMateRefName` reads `next_ref`), which makes it the standard
  // translocation view: reads whose mate landed on another chromosome each take
  // that chromosome's color.
  //
  // LGVSyntenyDisplay spells its own label for it ("Query name"): a PAF block
  // has no mate, and on a BAM "query name" means QNAME, i.e. the read name —
  // the one thing this scheme does not color by.
  mateRefName: {
    type: 'mateRefName',
    bodyScheme: 'tag',
    menu: { kind: 'radio', label: 'Mate chromosome', group: 'pairedEnd' },
    workerExtracts: true,
  },
  // methylation/bisulfite reuse the modifications shader path with different
  // config (see model getMethBins / bisulfite is reference-based)
  modifications: {
    type: 'modifications',
    bodyScheme: 'modifications',
    menu: { kind: 'special', label: 'Modification type' },
    workerExtracts: true,
  },
  bisulfite: {
    type: 'bisulfite',
    bodyScheme: 'modifications',
    menu: { kind: 'special', label: 'Bisulfite' },
    workerExtracts: true,
  },
}

// True for the modification family (modifications/methylation/bisulfite) — the
// schemes that share the 'modifications' shader path and drive the MM/ML
// overlay, mod-coverage, and legend. Derived from the registry so the family
// membership lives in exactly one place instead of being re-spelled as a
// three-way `||` at every consumer.
export function isModificationScheme(type: ColorSchemeType) {
  return COLOR_SCHEMES[type].bodyScheme === 'modifications'
}

// True for the two schemes whose worker output is one entry per aligned base of
// every read — the only fetches that grow with bases x depth rather than with
// events, and so the only ones the sub-pixel bin applies to. Derived from the
// registry for the reason `isModificationScheme` is.
export function isPerBaseScheme(type: ColorSchemeType) {
  return COLOR_SCHEMES[type].perBase === true
}

/** Whether the per-base layer draws modification marks. */
export function paintsModifications(layer: BaseLayer | undefined) {
  return layer !== undefined && isModificationScheme(layer.type)
}

/** Whether the per-base layer draws a cell for every aligned base. */
export function paintsEveryBase(layer: BaseLayer | undefined) {
  return layer !== undefined && isPerBaseScheme(layer.type)
}

// The part of `colorBy` the RPC worker actually reads, for `rpcProps`. A scheme
// the shader decides on its own (strand, mapping quality, insert size, pair
// orientation …) needs no worker data at all — the arrays it colors from are
// produced on every fetch — so every one of them projects to `undefined` and
// switching between them leaves `rpcProps` unchanged. That makes those switches
// a redraw (the read categories rebake) instead of dropping
// `rpcDataMap` and re-reading the region, which is what sending the raw
// `colorBy` did: flipping strand → mapping quality → insert size cost three
// full refetches to paint arrays that were already in memory.
//
// The worker treats a missing colorBy exactly as it treats a shader-only one:
// modification TYPES are still detected on every fetch (the detection loop in
// extractModifications is ungated, so the Modifications menu still populates),
// only the paint/extract passes are gated.
export function workerColorBy(colorBy: ReadColorBy): ReadColorBy | undefined {
  return COLOR_SCHEMES[colorBy.type].workerExtracts ? colorBy : undefined
}
