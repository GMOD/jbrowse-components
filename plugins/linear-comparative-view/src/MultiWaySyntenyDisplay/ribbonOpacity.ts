import {
  attributeOf,
  createOpacityFunction,
  isAttributeLabels,
  opacityFadeOf,
  opacityLevel,
  parseAttributeValue,
  readChannelValue,
} from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'
import type {
  AttributeRange,
  SyntenyOpacitySnapshot,
} from '@jbrowse/synteny-core'

/** Every ribbon's opacity while `ribbons.encoding.opacity` is unset. */
export const RIBBON_OPACITY = 0.3

export interface RibbonOpacity {
  /** every ribbon's opacity before a field's fade */
  level: number
  /** a ribbon's share of `level` under a field, undefined for the constant */
  fadeOf?: (record: Feature) => number
}

/**
 * `ribbons.encoding.opacity` as each ribbon draws it, through the synteny
 * views' opacity channel: a ribbon's record is read into a one-value lane the
 * channel indexes.
 */
export function ribbonOpacityOf(
  setting: SyntenyOpacitySnapshot,
  attributeRanges: Record<string, AttributeRange>,
): RibbonOpacity {
  const level = opacityLevel(setting, RIBBON_OPACITY, attributeRanges)
  const fade = opacityFadeOf(setting)
  if (!fade?.field) {
    return { level }
  }
  const attribute = attributeOf(fade.field)
  const value = new Float32Array(1)
  const fadeAt = createOpacityFunction({
    setting: fade,
    attributes: { [attribute]: value },
    viewRanges: attributeRanges,
    fetchRanges: attributeRanges,
  })
  if (!fadeAt) {
    return { level }
  }
  const range = attributeRanges[fade.field]
  const labelIndex =
    range && isAttributeLabels(range)
      ? new Map(range.labels.map((label, i) => [label, i]))
      : undefined
  return {
    level,
    fadeOf: record => {
      if (labelIndex) {
        const parsed = parseAttributeValue(record.get(attribute))
        value[0] =
          parsed === undefined
            ? Number.NaN
            : (labelIndex.get(String(parsed)) ?? Number.NaN)
      } else {
        value[0] = readChannelValue(record, attribute)
      }
      return fadeAt(0)
    },
  }
}
