import type { ColorSchemeType, ShaderScheme } from './types.ts'

export type ColorGroup = 'basic' | 'pairedEnd'

// Menu placement for a color scheme. Discriminated so a scheme is either a plain
// radio (shown in the 'basic' top-level list or the 'pairedEnd' submenu) or
// 'special' — driven by its own dialog/submenu (tag, modifications, methylation,
// bisulfite) or a legacy alias never shown on its own ('stranded').
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
  },
  perBaseLetter: {
    type: 'perBaseLetter',
    // like perBaseQuality: nucleotide quads paint over the 'normal' body
    shaderScheme: 'normal',
    menu: { kind: 'radio', label: 'Per-base lettering', group: 'basic' },
  },
  insertSize: {
    type: 'insertSize',
    shaderScheme: 'insertSize',
    menu: { kind: 'radio', label: 'Insert size', group: 'pairedEnd' },
  },
  insertSizeGradient: {
    type: 'insertSizeGradient',
    shaderScheme: 'insertSizeGradient',
    menu: {
      kind: 'radio',
      label: 'Insert size (gradient)',
      group: 'pairedEnd',
    },
  },
  firstOfPairStrand: {
    type: 'firstOfPairStrand',
    shaderScheme: 'firstOfPairStrand',
    menu: { kind: 'radio', label: 'First of pair strand', group: 'pairedEnd' },
  },
  pairOrientation: {
    type: 'pairOrientation',
    shaderScheme: 'pairOrientation',
    menu: { kind: 'radio', label: 'Pair orientation', group: 'pairedEnd' },
  },
  insertSizeAndOrientation: {
    type: 'insertSizeAndOrientation',
    shaderScheme: 'insertSizeAndOrientation',
    menu: {
      kind: 'radio',
      label: 'Insert size and orientation',
      group: 'pairedEnd',
    },
  },
  // legacy alias for firstOfPairStrand; never shown as its own radio
  stranded: {
    type: 'stranded',
    shaderScheme: 'firstOfPairStrand',
    menu: { kind: 'special', label: 'First of pair strand' },
  },
  tag: {
    type: 'tag',
    shaderScheme: 'tag',
    menu: { kind: 'special', label: 'Tag' },
  },
  // methylation/bisulfite reuse the modifications shader path with different
  // config (see model getMethBins / bisulfite is reference-based)
  modifications: {
    type: 'modifications',
    shaderScheme: 'modifications',
    menu: { kind: 'special', label: 'Modification type' },
  },
  methylation: {
    type: 'methylation',
    shaderScheme: 'modifications',
    menu: { kind: 'special', label: 'Methylation' },
  },
  bisulfite: {
    type: 'bisulfite',
    shaderScheme: 'modifications',
    menu: { kind: 'special', label: 'Bisulfite' },
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
export function pickColorOptions(...types: ColorSchemeType[]): ColorOption[] {
  return types.map(type => ({ type, label: colorSchemeLabel(type) }))
}
