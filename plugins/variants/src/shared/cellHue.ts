import { evaluateForFeature } from '@jbrowse/core/configuration'
import { dealKeyColors } from '@jbrowse/core/util/categoricalField'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { colorFieldOf } from '@jbrowse/display-kit/colorConfigSchema'

import { ALT_HUE } from './cellFill.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import {
  IMPACT_FIELD,
  getImpactColor,
  getVariantImpactDomain,
} from './variantConsequence.ts'

import type { VariantUnit } from './constants.ts'
import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/** The field a colour encoding names, or undefined for a constant. */
export function cellHueField(encoding: ColorEncoding | undefined) {
  return typeof encoding === 'object' ? encoding.field : undefined
}

/**
 * The categorical or threshold field a record field paints through, dealing
 * its colours into `held`, or undefined for a preset or a constant. A record
 * with no value keeps the default alt hue.
 */
export function recordHueField(
  encoding: ColorEncoding | undefined,
  held?: HeldSlots,
) {
  const field = cellHueField(encoding)
  return field === undefined ||
    field === IMPACT_FIELD ||
    field === PHASE_SET_FIELD
    ? undefined
    : colorFieldOf(encoding, held)
}

/** A record field's key colour, the no-value key taking the default alt hue. */
export function recordKeyColor(
  field: { color: (key: string) => string },
  key: string,
) {
  return key === '' ? ALT_HUE : field.color(key)
}

/**
 * What the worker reads off each variant for the alt cells' hue: the colour a
 * `jexl:` callback returns, or a field's value as text. Undefined where the
 * hue needs nothing from the record.
 */
export type CellHueRead = string | { field: string } | undefined

/**
 * Where the alt cells' hue comes from: `read`, what the worker reads off each
 * variant, a field without its scale so recolouring one refetches nothing;
 * `hueOf`, a read value's colour; `keyOf`, the key row it files under;
 * `deal`, which sees a region's values before `hueOf` paints any; and
 * `constant`, the hue of every alt cell with no value of its own. No paint
 * member set paints the genotype colours.
 */
export interface CellHue {
  read: CellHueRead
  constant?: string
  hueOf?: (value: string) => string
  keyOf?: (value: string) => string
  deal?: (values: readonly string[]) => void
}

/**
 * The hue a `color` encoding paints. `keptField` is the field a setting keeps
 * under `scale: 'none'` for the way back: its values are read while a
 * constant or the genotype colours paint, so returning to it refetches
 * nothing. A phase set is the exception, since reading it paints it.
 */
export function cellHueOf(
  encoding: ColorEncoding | undefined,
  keptField?: string,
  held?: HeldSlots,
): CellHue {
  if (typeof encoding === 'string' && isJexl(encoding)) {
    return { read: encoding, hueOf: css => css }
  }
  const field = cellHueField(encoding)
  if (field === IMPACT_FIELD) {
    return { read: { field }, hueOf: getImpactColor, keyOf: tier => tier }
  }
  if (field === PHASE_SET_FIELD) {
    return { read: { field } }
  }
  const record = recordHueField(encoding, held)
  if (record) {
    return {
      read: { field: record.field },
      hueOf: value => recordKeyColor(record, record.key(value)),
      keyOf: value => record.key(value),
      deal: values => {
        dealKeyColors(record, values.map(record.key))
      },
    }
  }
  return {
    read:
      keptField && keptField !== PHASE_SET_FIELD
        ? { field: keptField }
        : undefined,
    constant: typeof encoding === 'string' ? encoding : undefined,
  }
}

export function sameHueRead(a: CellHueRead, b: CellHueRead) {
  return typeof a === 'object' && typeof b === 'object'
    ? a.field === b.field
    : a === b
}

/** What the cell loops read off each variant, resolved once per fetch. */
export interface CellHueReader {
  value?: (feature: Feature) => string | undefined
  /** Phase-set hues, read per haplotype by the phased loop. */
  byPhaseSet?: boolean
}

export function cellHueReaderOf(
  read: CellHueRead,
  {
    jexl,
    unit,
  }: {
    jexl: JexlInstance
    unit: VariantUnit
  },
): CellHueReader {
  if (read === undefined) {
    return {}
  }
  if (typeof read === 'string') {
    return {
      value: feature => {
        try {
          const css = evaluateForFeature(read, feature, jexl)
          return typeof css === 'string' ? css : undefined
        } catch {
          return undefined
        }
      },
    }
  }
  switch (read.field) {
    case IMPACT_FIELD:
      return { value: getVariantImpactDomain }
    case PHASE_SET_FIELD:
      return { byPhaseSet: unit === 'haplotype' }
  }
  const get = fieldReader(read.field, jexl)
  return { value: feature => valueText(get(feature)) }
}

/**
 * What a cell loop read for the hue: `featureColorValues` is each variant's
 * one-based index into `colorValues`, 0 where it read none, and
 * `paintedColorValues` the indices a variant with an alt cell carried.
 */
export interface CellHueValues {
  featureColorValues: Uint32Array
  colorValues: string[]
  paintedColorValues: number[]
}

/**
 * Collects {@link CellHueValues} as a cell loop walks: `add` answers a
 * variant's index into the values.
 */
export function makeHueValueTable() {
  const indexOf = new Map<string, number>()
  const values: string[] = []
  const painted = new Set<number>()
  return {
    add(value: string | undefined, altPainted: boolean) {
      if (value === undefined) {
        return 0
      }
      let index = indexOf.get(value)
      if (index === undefined) {
        index = values.push(value)
        indexOf.set(value, index)
      }
      if (altPainted) {
        painted.add(index - 1)
      }
      return index
    },
    result() {
      return { colorValues: values, paintedColorValues: [...painted] }
    },
  }
}
