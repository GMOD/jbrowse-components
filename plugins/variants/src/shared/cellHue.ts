import { readConfigValue } from '@jbrowse/core/configuration'
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

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/** The field a colour encoding names, or undefined for a constant. */
export function cellHueField(encoding: ColorEncoding | undefined) {
  return typeof encoding === 'object' ? encoding.field : undefined
}

/**
 * The categorical or threshold field a record field paints through, or
 * undefined for a preset or a constant. A record with no value keeps the
 * default alt hue.
 */
export function recordHueField(encoding: ColorEncoding | undefined) {
  const field = cellHueField(encoding)
  return field === undefined ||
    field === IMPACT_FIELD ||
    field === PHASE_SET_FIELD
    ? undefined
    : colorFieldOf(encoding)
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
 * hue needs nothing from the record: the genotype colours and a constant.
 */
export type CellHueRead = string | { field: string } | undefined

/**
 * The fetch's share of a `color` encoding. A field crosses without its scale,
 * so recolouring one refetches nothing.
 */
export function cellHueRead(encoding: ColorEncoding | undefined): CellHueRead {
  if (typeof encoding === 'string') {
    return isJexl(encoding) ? encoding : undefined
  }
  const field = cellHueField(encoding)
  return field === IMPACT_FIELD ||
    field === PHASE_SET_FIELD ||
    recordHueField(encoding)
    ? { field: field! }
    : undefined
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
    renderingMode,
  }: {
    jexl: JexlInstance
    renderingMode: string
  },
): CellHueReader {
  if (read === undefined) {
    return {}
  }
  if (typeof read === 'string') {
    const cfg = { color: read }
    return {
      value: feature => {
        try {
          const css = readConfigValue(cfg, 'color', feature, jexl)
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
      return { byPhaseSet: renderingMode === 'phased' }
  }
  const get = fieldReader(read.field, jexl)
  return { value: feature => valueText(get(feature)) }
}

/**
 * The distinct values a cell loop read, and which of them a variant carrying
 * an alt cell had. `add` answers a variant's one-based index into `values`, 0
 * where it read none.
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

/**
 * How the main thread paints the values the worker read: `hueOf` a value's
 * colour, `keyOf` the key row it files under, and `constant` the hue of every
 * alt cell with no value of its own. All unset paints the genotype colours.
 */
export interface CellPaint {
  constant?: string
  hueOf?: (value: string) => string
  keyOf?: (value: string) => string
}

export function cellPaintOf(encoding: ColorEncoding | undefined): CellPaint {
  if (typeof encoding === 'string') {
    return isJexl(encoding) ? { hueOf: css => css } : { constant: encoding }
  }
  if (cellHueField(encoding) === IMPACT_FIELD) {
    return { hueOf: getImpactColor, keyOf: tier => tier }
  }
  const field = recordHueField(encoding)
  return field
    ? {
        hueOf: value => recordKeyColor(field, field.key(value)),
        keyOf: value => field.key(value),
      }
    : {}
}
