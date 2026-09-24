import { readConfigValue } from '@jbrowse/core/configuration'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { colorFieldOf } from '@jbrowse/display-kit/colorConfigSchema'

import { ALT_HUE } from './cellFill.ts'
import { PHASE_SET_FIELD } from './getPhasedColor.ts'
import {
  IMPACT_FIELD,
  getVariantImpactColor,
  getVariantImpactDomain,
} from './variantConsequence.ts'
import {
  NON_SV_TYPE,
  SV_TYPE_FIELD,
  getVariantSvType,
} from './variantSvType.ts'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { ColorEncoding } from '@jbrowse/core/util/markEncoding'

/** What the cell loops paint an alt cell's hue by, resolved once per fetch. */
export interface CellHue {
  /** The variant's hue, or undefined for the genotype colours. */
  color?: (feature: Feature) => string | undefined
  /** The scale's domain value the legend lists, for a field that has one. */
  domain?: (feature: Feature) => string
  /** Phase-set hues, read per haplotype by the phased loop. */
  byPhaseSet?: boolean
}

/** The field a colour encoding names, or undefined for a constant. */
export function cellHueField(encoding: ColorEncoding | undefined) {
  return typeof encoding === 'object' ? encoding.field : undefined
}

/**
 * The categorical or threshold field a record field paints through, or
 * undefined for a preset or a constant. A record with no value keeps the
 * default alt hue, as a record with no structural class does under `svType`.
 */
export function recordHueField(encoding: ColorEncoding | undefined) {
  const field = cellHueField(encoding)
  return field === undefined ||
    field === IMPACT_FIELD ||
    field === SV_TYPE_FIELD ||
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

function svTypeDomain(feature: Feature) {
  return getVariantSvType(feature) || NON_SV_TYPE
}

/**
 * The per-variant hue a `color` encoding paints the alt cells with. Runs once
 * per feature, not per cell, so a jexl callback or a field read costs
 * O(variants). `svTypeColors` is the palette the worker dealt over the types
 * present.
 */
export function cellHueOf(
  encoding: ColorEncoding | undefined,
  {
    jexl,
    svTypeColors,
    renderingMode,
  }: {
    jexl: JexlInstance
    svTypeColors: Record<string, string>
    renderingMode: string
  },
): CellHue {
  if (!encoding) {
    return {}
  }
  if (typeof encoding === 'string') {
    const cfg = { color: encoding }
    return {
      color: feature => {
        try {
          const css = readConfigValue(cfg, 'color', feature, jexl)
          return typeof css === 'string' ? css : undefined
        } catch {
          return undefined
        }
      },
    }
  }
  switch (encoding.field) {
    case IMPACT_FIELD:
      return { color: getVariantImpactColor, domain: getVariantImpactDomain }
    case SV_TYPE_FIELD:
      return {
        color: feature => svTypeColors[svTypeDomain(feature)],
        domain: svTypeDomain,
      }
    case PHASE_SET_FIELD:
      return { byPhaseSet: renderingMode === 'phased' }
  }
  const field = recordHueField(encoding)
  if (!field) {
    return {}
  }
  const read = fieldReader(field.field, jexl)
  const domain = (feature: Feature) => field.key(read(feature))
  return {
    color: feature => recordKeyColor(field, domain(feature)),
    domain,
  }
}
