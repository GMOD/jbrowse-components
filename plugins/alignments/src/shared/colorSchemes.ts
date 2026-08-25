import { LEGACY_COLOR_SCHEME_TYPES } from './types.ts'

import type {
  ColorBy,
  ColorSchemeType,
  PersistedColorBy,
  ShaderScheme,
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
  // Shader dispatch path; resolved to a numeric index through `ColorScheme`
  // (display constants), which is typed `Record<ShaderScheme, number>` so this
  // name always names a real shader branch.
  shaderScheme: ShaderScheme
  menu: ColorSchemeMenu
  // Color depends on the read's MATE (insert size / pair orientation), so an
  // unmapped mate (tlen=0) or inter-chromosomal mate needs its own color bucket
  // rather than a misleading insert/orientation hue. Drives `orientationSchemes`
  // in colorUtils.ts, and that is now the only reader: read.slang used to
  // hard-code the same membership for its own classification, and no longer
  // classifies at all.
  mateAware?: boolean
  // Meaningful only for paired-end data, so toggling "view as pairs" auto-
  // switches these on/off (see PAIRING_COLOR_SCHEMES in the model). Broader than
  // mateAware: first-of-pair strand is paired-only but reads only its own flags,
  // so it is pairedOnly but NOT mateAware.
  pairedOnly?: boolean
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
    shaderScheme: 'normal',
    menu: { kind: 'radio', label: 'Normal', group: 'basic' },
  },
  strand: {
    type: 'strand',
    shaderScheme: 'strand',
    menu: { kind: 'radio', label: 'Strand', group: 'basic' },
  },
  mappingQuality: {
    type: 'mappingQuality',
    shaderScheme: 'mappingQuality',
    menu: { kind: 'radio', label: 'Mapping quality', group: 'basic' },
  },
  perBaseQuality: {
    type: 'perBaseQuality',
    // per-base overlay paints colored rects on top of a neutral 'normal' body
    shaderScheme: 'normal',
    menu: { kind: 'radio', label: 'Per-base quality', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  perBaseLetter: {
    type: 'perBaseLetter',
    // like perBaseQuality: nucleotide quads paint over the 'normal' body
    shaderScheme: 'normal',
    menu: { kind: 'radio', label: 'Per-base lettering', group: 'basic' },
    perBase: true,
    workerExtracts: true,
  },
  insertSize: {
    type: 'insertSize',
    shaderScheme: 'insertSize',
    menu: { kind: 'radio', label: 'Insert size', group: 'pairedEnd' },
    mateAware: true,
    pairedOnly: true,
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    shaderScheme: 'firstOfPairStrand',
    menu: { kind: 'radio', label: 'First of pair strand', group: 'pairedEnd' },
    pairedOnly: true,
  },
  pairOrientation: {
    type: 'pairOrientation',
    shaderScheme: 'pairOrientation',
    menu: { kind: 'radio', label: 'Pair orientation', group: 'pairedEnd' },
    mateAware: true,
    pairedOnly: true,
  },
  insertSizeAndOrientation: {
    type: 'insertSizeAndOrientation',
    shaderScheme: 'insertSizeAndOrientation',
    menu: {
      kind: 'radio',
      label: 'Insert size and orientation',
      group: 'pairedEnd',
    },
    mateAware: true,
    pairedOnly: true,
  },
  tag: {
    type: 'tag',
    shaderScheme: 'tag',
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
  // that chromosome's color. Not `pairedOnly` — that flag resets a scheme when
  // "view as pairs" is switched off, and this is an explicit categorical choice
  // like `tag`, which draws on an ordinary pileup too.
  //
  // LGVSyntenyDisplay spells its own label for it ("Query name"): a PAF block
  // has no mate, and on a BAM "query name" means QNAME, i.e. the read name —
  // the one thing this scheme does not color by.
  mateRefName: {
    type: 'mateRefName',
    shaderScheme: 'tag',
    menu: { kind: 'radio', label: 'Mate chromosome', group: 'pairedEnd' },
    workerExtracts: true,
  },
  // methylation/bisulfite reuse the modifications shader path with different
  // config (see model getMethBins / bisulfite is reference-based)
  modifications: {
    type: 'modifications',
    shaderScheme: 'modifications',
    menu: { kind: 'special', label: 'Modification type' },
    workerExtracts: true,
  },
  bisulfite: {
    type: 'bisulfite',
    shaderScheme: 'modifications',
    menu: { kind: 'special', label: 'Bisulfite' },
    workerExtracts: true,
  },
}

export interface ColorOption {
  label: string
  type: ColorSchemeType
}

// Human label for any scheme, so a menu can name the active scheme instead of
// pointing at it with a bare "this color scheme".
export function colorSchemeLabel(type: ColorSchemeType): string {
  return COLOR_SCHEMES[type].menu.label
}

// True for the modification family (modifications/methylation/bisulfite) — the
// schemes that share the 'modifications' shader path and drive the MM/ML
// overlay, mod-coverage, and legend. Derived from the registry so the family
// membership lives in exactly one place instead of being re-spelled as a
// three-way `||` at every consumer.
export function isModificationScheme(type: ColorSchemeType) {
  return COLOR_SCHEMES[type].shaderScheme === 'modifications'
}

// True for the two schemes whose worker output is one entry per aligned base of
// every read — the only fetches that grow with bases x depth rather than with
// events, and so the only ones the sub-pixel bin applies to. Derived from the
// registry for the reason `isModificationScheme` is.
export function isPerBaseScheme(type: ColorSchemeType) {
  return COLOR_SCHEMES[type].perBase === true
}

// The part of `colorBy` the RPC worker actually reads, for `rpcProps`. A scheme
// the shader decides on its own (strand, mapping quality, insert size, pair
// orientation …) needs no worker data at all — the arrays it colors from are
// produced on every fetch — so every one of them projects to `undefined` and
// switching between them leaves `rpcProps` unchanged. That makes those switches
// a redraw (`colorSchemeIndex` is in `renderState`) instead of dropping
// `rpcDataMap` and re-reading the region, which is what sending the raw
// `colorBy` did: flipping strand → mapping quality → insert size cost three
// full refetches to paint arrays that were already in memory.
//
// The worker treats a missing colorBy exactly as it treats a shader-only one:
// modification TYPES are still detected on every fetch (the detection loop in
// extractModifications is ungated, so the Modifications menu still populates),
// only the paint/extract passes are gated.
export function workerColorBy(colorBy: ColorBy): ColorBy | undefined {
  return COLOR_SCHEMES[colorBy.type].workerExtracts ? colorBy : undefined
}

// Upgrade a persisted colorBy to canonical form: the retired standalone
// `methylation` scheme becomes `modifications` with `fillUnmarked` set (its
// cytosine context preserved), the retired `stranded` alias becomes the
// `firstOfPairStrand` it always meant, and the retired `insertSizeGradient`
// becomes the `insertSize` it shared every threshold and bucket with. Applied in
// the model's `colorBy` getter so no live code — extraction, menu, legend,
// shader dispatch — ever sees a removed type. Idempotent on already-canonical
// values.
export function normalizeColorBy(colorBy: PersistedColorBy): ColorBy {
  return colorBy.type === 'methylation'
    ? {
        type: 'modifications',
        modifications: { ...colorBy.modifications, fillUnmarked: true },
      }
    : colorBy.type === 'stranded'
      ? { type: 'firstOfPairStrand' }
      : colorBy.type === 'insertSizeGradient'
        ? { type: 'insertSize' }
        : colorBy
}

// widened for the `includes` check below, which takes an arbitrary string
const legacyTypes: readonly string[] = LEGACY_COLOR_SCHEME_TYPES

// A persisted `colorBy` value is only usable once its `.type` still names a
// registered scheme: the lookups above (colorSchemeLabel, isModificationScheme,
// the model's colorSchemeIndexFor) are total over ColorSchemeType by design and
// throw on anything else, so a stale/renamed name from a saved session or
// session-wide default must be rejected before it reaches them. The retired
// names are accepted here (normalizeColorBy upgrades them at read time) so
// legacy sessions keep resolving. Wired as the `colorBy` slot's promotable
// `validate` hook (see promotableDefaults.ts).
export function isRegisteredColorScheme(
  value: unknown,
): value is PersistedColorBy {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string' &&
    (value.type in COLOR_SCHEMES || legacyTypes.includes(value.type))
  )
}

type RadioColorScheme = ColorSchemeDef & {
  menu: Extract<ColorSchemeMenu, { kind: 'radio' }>
}

// The radio schemes for a menu group, in registry (= menu) order. A user-defined
// guard narrows to radio entries so `menu.label` reads without a cast.
export function radioColorOptions(group: ColorGroup): ColorOption[] {
  return Object.values(COLOR_SCHEMES)
    .filter(
      (s): s is RadioColorScheme =>
        s.menu.kind === 'radio' && s.menu.group === group,
    )
    .map(({ type, menu }) => ({ type, label: menu.label }))
}

// Curated subset of schemes, in the given order, with labels sourced from the
// registry — for consumers (e.g. synteny) that support only a handful of schemes
// and shouldn't re-spell the labels at the call site.
//
// An entry may instead be a whole `{type,label}` to override the label for one
// display, which is for the case where the registry name is right in one domain
// and wrong in another (`mateRefName`: a mate's chromosome on a BAM, a query
// contig on a PAF). Taking it inline keeps the curated list one ordered call
// rather than a `pickColorOptions(...)` spread with a literal appended, so the
// menu order stays visible in one place; `type` is still a `ColorSchemeType`, so
// an override can't name a scheme the registry doesn't have.
export function pickColorOptions(
  ...types: (ColorSchemeType | ColorOption)[]
): ColorOption[] {
  return types.map(t =>
    typeof t === 'string' ? { type: t, label: colorSchemeLabel(t) } : t,
  )
}
