import { svClassOf } from '@jbrowse/core/util/svAlt'

import { ALT_HUE } from './cellFill.ts'

import type { CategoricalEntry } from '@jbrowse/core/ui/colorScale'
import type { Feature } from '@jbrowse/core/util'
import type { SV_CLASSES } from '@jbrowse/core/util/svAlt'

// The colour preset field for the structural-variant class `svClassOf` names.
// The multi-sample displays paint it from the palette the worker ships; the
// single-variant display paints it through SV_TYPE_COLOR_JEXL.
export const SV_TYPE_FIELD = 'svType'

// What `{ field: 'svType' }` paints on the single-variant display: the class
// colours, and grey for a record with no class.
export const SV_TYPE_COLOR_JEXL = 'jexl:svTypeColor(feature)'

/**
 * The domain value a record with no structural class takes when the multi-sample
 * displays paint by SV type. An explicit member of the scale, not a gap in it:
 * without one, half a mixed callset painted the default alt blue beside the
 * class colors and the mode read as two scales at once.
 */
export const NON_SV_TYPE = 'SNV/indel'

// what a record with no structural class paints on the single-variant display
export const NON_SV_COLOR = '#808080'

// The classes in key order, with their colors and labels. Deletion red and
// duplication blue are the field's convention (UCSC's dbVar tracks, gnomAD);
// insertion is palette.insertion, so an insertion is one color across the
// pileup, the MAF display and this one. The rest keep apart from those, from
// each other and from the reference and no-call colors under deuteranopia and
// protanopia, and a token no class names takes OTHER rather than a hue of its
// own that a key would read as one more class.
export const PREDEFINED_SV_TYPES = [
  { type: 'DEL', label: 'Deletion', color: '#e41a1c' },
  { type: 'DUP', label: 'Duplication', color: '#377eb8' },
  { type: 'INS', label: 'Insertion', color: '#800080' },
  { type: 'INV', label: 'Inversion', color: '#ff7f00' },
  { type: 'CNV', label: 'Copy-number variable', color: '#7e6148' },
  { type: 'TR', label: 'Tandem repeat', color: '#e7298a' },
  { type: 'BND', label: 'Breakend / translocation', color: '#17becf' },
  { type: 'CPX', label: 'Complex', color: '#66a61e' },
  { type: 'OTHER', label: 'Other / mixed', color: '#000000' },
] as const satisfies readonly {
  type: (typeof SV_CLASSES)[number]
  label: string
  color: string
}[]

const PREDEFINED_COLOR: Record<string, string> = Object.fromEntries(
  PREDEFINED_SV_TYPES.map(t => [t.type, t.color]),
)
const PREDEFINED_LABEL: Record<string, string> = Object.fromEntries(
  PREDEFINED_SV_TYPES.map(t => [t.type, t.label]),
)

/**
 * A class's color, and grey for a record with no class. By class rather than
 * by feature, so a legend — which has counted its classes and no longer holds
 * a record of each — paints the same swatch the records themselves get.
 */
export function getSvTypeColor(type: string) {
  return PREDEFINED_COLOR[type] ?? NON_SV_COLOR
}

/** The SV-type key's rows for the display painting through `getSvTypeColor`. */
export function svTypeLegendEntries(): CategoricalEntry[] {
  return [
    ...PREDEFINED_SV_TYPES.map(t => ({
      value: t.label,
      label: t.label,
      color: t.color,
    })),
    {
      value: NON_SV_TYPE,
      label: NON_SV_TYPE,
      color: NON_SV_COLOR,
      missing: true,
    },
  ]
}

/**
 * The color a variant is painted, for the single-variant display's `color` slot
 * (via the `svTypeColor` jexl function).
 */
export function getVariantSvTypeColor(feature: Feature) {
  return getSvTypeColor(svClassOf(feature))
}

// Human-readable legend label for a class.
export function svTypeDisplayLabel(type: string) {
  return PREDEFINED_LABEL[type] ?? type
}

/**
 * The color each present class paints, in key order, the scale's "no
 * structural class" member last in the default alt hue: an alt cell with no
 * further meaning on it. A grey put its het and triploid shades on the
 * reference grey's own ramp.
 */
export function assignSvTypeColors(types: string[]): Record<string, string> {
  const present = new Set(types)
  const result: Record<string, string> = {}
  for (const { type, color } of PREDEFINED_SV_TYPES) {
    if (present.has(type)) {
      result[type] = color
    }
  }
  if (present.has(NON_SV_TYPE)) {
    result[NON_SV_TYPE] = ALT_HUE
  }
  return result
}
