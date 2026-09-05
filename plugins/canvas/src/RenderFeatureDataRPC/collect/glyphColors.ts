import { getFrame } from '@jbrowse/core/util'
import {
  cssColorToABGR as colorToUint32,
  featureBedColor,
} from '@jbrowse/core/util/colorBits'

import { LITERAL, OUTLINE, STROKE, cdsFrameClass } from '../colorClasses.ts'
import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from '../featureColors.ts'
import { getFeatureName } from '../labelUtils.ts'
import { THEME_DERIVED_COLOR, readConfigValueSafe } from '../renderConfig.ts'
import { isCDS, isUTR } from '../util.ts'

import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

// transl_except residues (selenocysteine, pyrrolysine, polyA-completed stops)
// get a distinct background so the readthrough stands out from the alternating
// codon shading — matches the orange `translExceptColor` swatch the
// feature-detail protein view uses.
export const TRANSL_EXCEPT_HIGHLIGHT = colorToUint32('#ffc850')

// Each mature-protein region gets a distinct fill from this palette (by row
// order) so adjacent cleavage products are visually separable; matches the
// legacy CanvasFeatureRenderer.
export const MATURE_PROTEIN_COLOR_HEX = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
  '#aec7e8', // light blue
  '#ffbb78', // light orange
]
export const MATURE_PROTEIN_COLORS = MATURE_PROTEIN_COLOR_HEX.map(c =>
  colorToUint32(c),
)

// CRISPR guide glyph: the PAM is overpainted red, drawn over the
// (config-colored) protospacer box, so it reads regardless of page theme since
// the box itself is its background.
export const CRISPR_PAM_COLOR = colorToUint32('#d32f2f')

// Cut-site tick for both cut-marking glyphs (CRISPR guide, restriction motif) —
// dark, and always drawn over the feature's own box for the same reason.
export const CUT_SITE_COLOR = colorToUint32('#111111')

// Per-subpart fills for intact transposons, keyed by SO type, ported verbatim
// from the legacy CanvasFeatureRenderer repeatRegion glyph. Stable colors (not
// a by-row palette) so the two LTRs share a color and the TSDs share another.
const REPEAT_COLOR_MAP: Record<string, string> = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

// Lowercased index over REPEAT_COLOR_MAP so the fill matches the same way the
// glyph dispatch does (see isRepeatRegion / isCDS).
const REPEAT_COLOR_BY_LOWER_TYPE = new Map(
  Object.entries(REPEAT_COLOR_MAP).map(([type, color]) => [
    type.toLowerCase(),
    color,
  ]),
)

export function repeatSubpartColor(type: string) {
  return REPEAT_COLOR_BY_LOWER_TYPE.get(type.toLowerCase())
}

// The internal *_retrotransposon body the flanking LTRs/TSDs are painted over.
export function isRetrotransposonBody(type: string) {
  return type.toLowerCase().endsWith('_retrotransposon')
}

// Fraction of full height for the internal retrotransposon body so the
// full-height LTRs/TSDs drawn on top of it remain visible as flanking caps.
export const REPEAT_BODY_HEIGHT_FRACTION = 0.65

// Fallback when a per-feature `color`/`utrColor` jexl expression throws (e.g. a
// callback referencing a missing plugin function or an attribute absent on some
// features). Magenta so the bad slot is visually obvious rather than silently
// wrong, matching parseCssColor's INVALID_COLOR contract — and, crucially, so
// one throwing feature degrades to a magenta box instead of failing the whole
// track render (the color slots are the last unguarded per-feature jexl reads;
// mouseover/labels already route through readConfigValueSafe).
const INVALID_COLOR = 'magenta'

// A BED's color rides on the top-level feature, but the gene glyph draws one
// box per subfeature (exon/CDS/UTR), which carry none — so look up the parent
// chain. Bare "255,0,0" is understood downstream by parseCssColor, so the value
// goes through as-is.
function inheritedBedColor(feature: Feature) {
  let cur: Feature | undefined = feature
  let found: string | undefined
  while (cur !== undefined && found === undefined) {
    found = featureBedColor(cur)
    cur = cur.parent?.()
  }
  return found
}

// The two fills a box can take, each with what its slot resolves to when unset
// and the feature declares no color of its own. UTRs get their own slot so a
// gene glyph can contrast them against the coding body.
const BOX_COLOR_SLOTS = {
  color: FEATURE_DEFAULT_COLOR,
  utrColor: UTR_DEFAULT_COLOR,
} as const

/**
 * A color the worker resolved, or the theme class the main thread has to
 * resolve for it. `color` is undefined exactly when `colorClass` is not
 * `LITERAL` — there is no literal to fall back to, because the worker has no
 * palette to read one from.
 */
export interface ClassedColor {
  color: string | undefined
  colorClass: number
}

/**
 * The box fill, unpacked: `emitCodonRects` lightens the CSS string, so unlike
 * `strokeColor` this one cannot pack here.
 */
export function boxColor(feature: Feature, ctx: RenderContext): ClassedColor {
  const { config, colorByCDS, jexl } = ctx
  // An unset (`maybeColor` undefined) slot means nothing asked for a color here,
  // so the file's own gets to speak; any set value wins, making "the config
  // beats the file" the single rule. Because unset is `undefined` rather than a
  // concrete default, every real color — goldenrod included — stays expressible.
  // utrColor deferring too is what reproduces UCSC's whole-item coloring, where
  // a thin block is thinner but not a different color; setting utrColor restores
  // the contrasting-UTR look.
  //
  // A UTR falls through to `color` when `utrColor` is unset, and this is what
  // makes the rule above hold for a whole transcript rather than for its coding
  // part. `color` describes the FEATURE; read as coding-only it broke its own
  // rule in the worst direction — with `color: 'red'` on a BED12 track, the
  // exon took red and the UTR of the same transcript took the file's itemRgb,
  // so the config beat the file at one end of a gene and lost to it at the
  // other. With no itemRgb it was worse-looking rather than incoherent: a red
  // gene with fixed teal ends. The visible cost was that a per-feature color had
  // to be authored TWICE — the hosted DTU demo carries the same 300-character
  // jexl in `color` and in `utrColor`, and the copy in the docs had already
  // drifted from the copy in the figure (18a40ce025).
  // Only a UTR that has a `utrColor` of its own reads that slot; every other box
  // reads `color`. When both are unset this still lands on the UTR default,
  // because the fallback below keys off the box and not off the slot it read.
  const isUtrBox = isUTR(feature)
  const slot = isUtrBox && config.utrColor !== undefined ? 'utrColor' : 'color'

  const fill =
    config[slot] === undefined
      ? (inheritedBedColor(feature) ??
        BOX_COLOR_SLOTS[isUtrBox ? 'utrColor' : 'color'])
      : readConfigValueSafe<string>(config, slot, feature, jexl, INVALID_COLOR)

  const featureStrand = feature.get('strand')
  const featurePhase = feature.get('phase')

  if (
    colorByCDS &&
    isCDS(feature) &&
    (featureStrand === 1 || featureStrand === -1) &&
    featurePhase !== undefined
  ) {
    const frame = getFrame(
      feature.get('start'),
      feature.get('end'),
      featureStrand,
      featurePhase,
    )
    const frameClass = cdsFrameClass(frame)
    // An unrecognized frame keeps the resolved fill, which is what the missing
    // `palette.framesCDS.at(frame)` entry used to do.
    if (frameClass !== LITERAL) {
      return { color: undefined, colorClass: frameClass }
    }
  }

  return { color: fill, colorClass: LITERAL }
}

/**
 * The connector/arrow stroke, packed. Packed here rather than at the four call
 * sites because none of them wants the CSS string — unlike `boxColor`, whose
 * string the codon shading lightens.
 *
 * A themed color has nothing to pack — its class names it and the main-thread
 * encode writes the lane — so the color slot carries 0, which the encode then
 * overwrites before anything draws from it.
 */
export function strokeColor(feature: Feature, ctx: RenderContext): PackedColor {
  const { config, jexl } = ctx
  // The themed stroke is `palette.text.secondary`, which is translucent; keeping
  // its alpha is what lets connector lines and strand arrows blend into the
  // track as a subtle grey rather than glaring full-white (dark mode) or
  // full-black (light mode) at forced opacity. An unset slot takes it, and so
  // does a throwing jexl — degrading to the subtle line rather than crashing
  // the render, which is what the `undefined` fallback below expresses now that
  // the worker holds no palette to name the color with.
  const configured =
    config.connectorColor === undefined
      ? undefined
      : readConfigValueSafe<string | undefined>(
          config,
          'connectorColor',
          feature,
          jexl,
          undefined,
        )
  return packColor(
    configured === undefined
      ? { color: undefined, colorClass: STROKE }
      : { color: configured, colorClass: LITERAL },
  )
}

/** A primitive's color as it is packed into a lane, beside its theme class. */
export interface PackedColor {
  color: number
  colorClass: number
}

export function packColor({ color, colorClass }: ClassedColor): PackedColor {
  return {
    color: color === undefined ? 0 : colorToUint32(color),
    colorClass,
  }
}

// Hover tooltip = the display's `mouseover` config slot evaluated against the
// full feature (the same slot the old SVG renderer used on the main thread), so
// a custom override — including one calling a plugin-registered jexl function —
// drives the text. Done worker-side because the full feature is already here;
// shipping a large feature back just to format a string would be wasteful. A
// throwing override degrades to the feature name rather than failing the render.
export function featureTooltip(feature: Feature, ctx: RenderContext) {
  return String(
    readConfigValueSafe<unknown>(
      ctx.config,
      'mouseover',
      feature,
      ctx.jexl,
      getFeatureName(feature) ?? '',
    ),
  )
}

// Feature-box outline. Empty means no outline (packed as 0). The menu toggle
// stores THEME_DERIVED_COLOR, resolved to text.primary at low alpha so the
// outline stays visible on both light and dark tracks (a fixed black outline
// vanishes on a dark background); in light mode this matches the old black-0.3.
export function resolveOutlineColor(outlineColor: string) {
  return outlineColor === THEME_DERIVED_COLOR
    ? { outlineColor: 0, outlineColorClass: OUTLINE }
    : {
        outlineColor: outlineColor ? colorToUint32(outlineColor) : 0,
        outlineColorClass: LITERAL,
      }
}
