import { FACET_LABELS, INSERT_SIZE_LABELS } from './facetLabels.ts'
import { COLOR_FIELDS } from './types.ts'

import type {
  BaseLayer,
  BodyFill,
  ColorFieldKind,
  ReadColorFieldKind,
} from './types.ts'

export type ColorGroup = 'basic' | 'pairedEnd'

// Menu placement for a color field. Discriminated so a field is either a plain
// radio (shown in the 'basic' top-level list or the 'pairedEnd' submenu) or
// 'special' — driven by its own dialog/submenu (tag, modifications, bisulfite).
export type ColorFieldMenu =
  | { kind: 'radio'; label: string; group: ColorGroup }
  | { kind: 'special'; label: string }

export interface ColorFieldDef {
  kind: ColorFieldKind
  bodyFill: BodyFill
  menu: ColorFieldMenu
  // Color depends on the read's MATE (insert size / pair orientation), so an
  // unmapped mate (tlen=0) or inter-chromosomal mate is a level of its own
  // rather than a misleading insert/orientation hue (`overrideCategory`).
  mateAware?: boolean
  // The field reads how a read sits in its fragment, so in a chain the split
  // junction kinds and an unpaired segment's strand against its molecule's
  // are levels of it too (`overrideCategory`).
  orientation?: boolean
  // The worker emits one entry per ALIGNED BASE of every read for this field,
  // rather than one per event: the two walls this pipeline paints. Every other
  // field's worker output is sparse in the reads' bases, so these are the only
  // two whose extract is sampled at `subPixelBinBp` (see `perBaseBinBp` on the
  // display, which is the only reader).
  perBase?: boolean
  // The worker extracts different DATA for this field — per-base arrays,
  // modification marks, per-read tag strings, a reference-sequence fetch. Every
  // other field is decided entirely in the shader from arrays the worker always
  // produces, so switching between those must not refetch: `workerColorField`
  // collapses them to one value, keeping `rpcProps` (and therefore the fetched
  // data) identical across the switch. Under-declaring this renders stale data,
  // so a new field's flag is asserted against what the worker actually reads —
  // see workerColorField.test.ts.
  workerExtracts?: boolean
}

// The one registry of what each color field paints, keyed by ColorFieldKind:
// a named field, `tag` for any tag or attribute, `normal` for none. ("Scheme"
// is the ramp a channel's `scale.scheme` names.) Adding a kind to the union is
// a compile error until it is classified here with BOTH a shader path and a
// menu placement, so a field cannot be half-wired. Insertion order is the menu
// order (Object.values preserves it), so the derived radio lists need no
// re-sorting. A read category (svSignal, pairing, split, spliced) is no color
// field: reads take their arcs' colors, and Group by separates the categories
// (ADR-230).
export const COLOR_FIELD_DEFS: Record<ColorFieldKind, ColorFieldDef> = {
  normal: {
    kind: 'normal',
    bodyFill: 'normal',
    menu: { kind: 'radio', label: 'Normal', group: 'basic' },
  },
  strand: {
    kind: 'strand',
    bodyFill: 'strand',
    menu: { kind: 'radio', label: FACET_LABELS.strand, group: 'basic' },
  },
  mapq: {
    kind: 'mapq',
    bodyFill: 'mapq',
    menu: { kind: 'radio', label: FACET_LABELS.mapq, group: 'basic' },
  },
  baseQuality: {
    kind: 'baseQuality',
    // per-base overlay paints colored rects on top of a neutral 'normal' body
    bodyFill: 'normal',
    menu: { kind: 'radio', label: 'Per-base quality', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  base: {
    kind: 'base',
    // like baseQuality: nucleotide quads paint over the 'normal' body
    bodyFill: 'normal',
    menu: { kind: 'radio', label: 'Per-base lettering', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  insertSize: {
    kind: 'insertSize',
    bodyFill: 'insertSize',
    menu: {
      kind: 'radio',
      label: INSERT_SIZE_LABELS.insertSize,
      group: 'pairedEnd',
    },
    mateAware: true,
  },
  firstOfPairStrand: {
    kind: 'firstOfPairStrand',
    bodyFill: 'firstOfPairStrand',
    menu: {
      kind: 'radio',
      label: FACET_LABELS.firstOfPairStrand,
      group: 'pairedEnd',
    },
  },
  pairOrientation: {
    kind: 'pairOrientation',
    bodyFill: 'pairOrientation',
    menu: {
      kind: 'radio',
      label: FACET_LABELS.pairOrientation,
      group: 'pairedEnd',
    },
    mateAware: true,
    orientation: true,
  },
  insertSizeAndOrientation: {
    kind: 'insertSizeAndOrientation',
    bodyFill: 'insertSizeAndOrientation',
    menu: {
      kind: 'radio',
      label: INSERT_SIZE_LABELS.insertSizeAndOrientation,
      group: 'pairedEnd',
    },
    mateAware: true,
    orientation: true,
  },
  tag: {
    kind: 'tag',
    bodyFill: 'tag',
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
  // LGVSyntenyDisplay spells its own label for it ("Query"): a PAF block
  // has no mate, and on a BAM "query name" means QNAME, i.e. the read name —
  // the one thing this field does not color by.
  mateRefName: {
    kind: 'mateRefName',
    bodyFill: 'tag',
    menu: { kind: 'radio', label: 'Mate chromosome', group: 'pairedEnd' },
    workerExtracts: true,
  },
  // bisulfite reuses the modifications shader path, read off the reference
  modifications: {
    kind: 'modifications',
    bodyFill: 'modifications',
    menu: { kind: 'special', label: 'Modification type' },
    workerExtracts: true,
  },
  bisulfite: {
    kind: 'bisulfite',
    bodyFill: 'modifications',
    menu: { kind: 'special', label: 'Bisulfite' },
    workerExtracts: true,
  },
}

// True for the modification family (modifications, bisulfite) — the
// fields that share the 'modifications' shader path and drive the MM/ML
// overlay, mod-coverage, and legend. Derived from the registry so the family
// membership lives in exactly one place instead of being re-spelled as a
// three-way `||` at every consumer.
export function isModificationField(kind: ColorFieldKind) {
  return COLOR_FIELD_DEFS[kind].bodyFill === 'modifications'
}

// True for the two fields whose worker output is one entry per aligned base of
// every read — the only fetches that grow with bases x depth rather than with
// events, and so the only ones the sub-pixel bin applies to. Derived from the
// registry for the reason `isModificationField` is.
export function isPerBaseField(kind: ColorFieldKind) {
  return COLOR_FIELD_DEFS[kind].perBase === true
}

/** Whether the per-base layer draws modification marks. */
export function paintsModifications(layer: BaseLayer | undefined) {
  return layer !== undefined && isModificationField(layer.field)
}

/** Whether the per-base layer draws a cell for every aligned base. */
export function paintsEveryBase(layer: BaseLayer | undefined) {
  return layer !== undefined && isPerBaseField(layer.field)
}

const PRESET_FIELDS = new Set<string>(COLOR_FIELDS)

/**
 * The kind a read fill's field paints through: undefined the plain fill, a
 * preset field its own, and a tag (`tags.HP`) or any other attribute the
 * per-read bake.
 */
export function colorFieldKindOf(
  field: string | undefined,
): ReadColorFieldKind {
  return field === undefined
    ? 'normal'
    : PRESET_FIELDS.has(field)
      ? (field as ReadColorFieldKind)
      : 'tag'
}

// The read fill field as the RPC worker reads it, for `rpcProps`. A field the
// shader decides on its own (strand, mapping quality, insert size, pair
// orientation …) needs no worker data at all — the arrays it colors from are
// produced on every fetch — so every one of them projects to `undefined` and
// switching between them leaves `rpcProps` unchanged. That makes those switches
// a redraw (the read categories rebake) instead of dropping `rpcDataMap` and
// re-reading the region: sending every field cost flipping strand → mapping
// quality → insert size three full refetches of arrays already in memory.
//
// Modification TYPES are still detected on every fetch (the detection loop in
// extractModifications is ungated, so the Modifications menu still populates);
// only the paint/extract passes are gated.
export function workerColorField(field: string | undefined) {
  return COLOR_FIELD_DEFS[colorFieldKindOf(field)].workerExtracts
    ? field
    : undefined
}
