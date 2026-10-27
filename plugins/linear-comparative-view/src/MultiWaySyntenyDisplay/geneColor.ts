import { readConfObject } from '@jbrowse/core/configuration'
import { featureDefaultColor, utrDefaultColor } from '@jbrowse/core/ui/palette'
import { dealShownKeyColors } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  FEATURE_FIELD_PRESETS,
  colorEncodingOf,
  colorFieldOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { rampEncodingOf, valueRampOf } from '@jbrowse/display-kit/valueRamp'

import type { MultiWaySyntenyDisplayConfig } from './configSchema.ts'
import type { HeldSlots } from '@jbrowse/core/ui/colors'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type {
  ColorSetting,
  FieldColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import type { ValueRamp } from '@jbrowse/display-kit/valueRamp'

/** paints each gene and box by its ortholog group, one color down the stack */
export const CLUSTER_FIELD = 'cluster'

export interface PaintedFill {
  css: string
  packed: number
  /** the value a painting field filed the mark under, unset under `value` */
  key?: string
}

export interface GeneColorSettings {
  color: ColorSetting
  utrColor: unknown
}

/**
 * Resolves a fill once per feature or value. Only `cluster` fields read
 * `cluster`. A UTR takes `fill`, the gene's, unless `utrs.encoding.color`
 * names one, or nothing sets the fill.
 */
export interface GeneColors {
  fill: (feature: Feature, cluster: string | undefined) => PaintedFill
  utr: (feature: Feature, fill: PaintedFill) => number
}

/** What the gene `encoding.color` paints, `score` a ramp as on a feature track. */
export function geneColorEncodingOf(setting: ColorSetting) {
  return colorEncodingOf(setting, FEATURE_FIELD_PRESETS)
}

function readText(read: (feature: Feature) => unknown, feature: Feature) {
  try {
    return valueText(read(feature))
  } catch {
    // a jexl field that throws on a feature paints it no value
    return ''
  }
}

/**
 * The ramp a numeric field paints along, over the values the features
 * `features` lists carry, or undefined while the encoding paints no ramp.
 */
export function geneColorRampOf(
  encoding: string | undefined | FieldColorEncoding,
  jexl: JexlInstance,
  features: () => Iterable<Feature>,
): ValueRamp | undefined {
  const ramp = rampEncodingOf(encoding)
  if (ramp) {
    const read = fieldReader(ramp.field, jexl)
    return valueRampOf(
      ramp,
      Array.from(features(), feature => readText(read, feature)),
    )
  }
  return undefined
}

/**
 * Deals the values `features` carry under a painting field as one batch, so
 * the genes and boxes on screen together take colors apart whichever paints
 * first. A cluster field deals as it paints.
 */
export function dealGeneColors(
  encoding: string | undefined | FieldColorEncoding,
  held: HeldSlots | undefined,
  jexl: JexlInstance,
  features: Iterable<Feature>,
) {
  const field = colorFieldOf(encoding, held)
  if (field && field.field !== CLUSTER_FIELD) {
    const read = fieldReader(field.field, jexl)
    const keys: string[] = []
    for (const feature of features) {
      try {
        keys.push(field.key(read(feature)))
      } catch {
        // a jexl field that throws on a feature paints it no value
      }
    }
    dealShownKeyColors(field, keys)
  }
}

function memo<K, V>(map: Map<K, V>, key: K, make: () => V) {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

/**
 * `encoding` is `geneColorEncoding`; `utrColor` is the slot as written;
 * `held`, where an ordinal field deals its colors; `ramp`, the one a numeric
 * field paints along (`geneColorRampOf`).
 */
export function geneColors(
  conf: MultiWaySyntenyDisplayConfig,
  encoding: string | undefined | FieldColorEncoding,
  utrColor: unknown,
  jexl: JexlInstance,
  held?: HeldSlots,
  ramp?: ValueRamp,
): GeneColors {
  const byCss = new Map<string, PaintedFill>()
  const byKey = new Map<string, PaintedFill>()
  const byFeature = new Map<string, PaintedFill>()
  const utrByFeature = new Map<string, number>()
  const painted = (css: string) =>
    memo(byCss, css, () => ({ css, packed: cssColorToABGR(css) }))

  const field = colorFieldOf(encoding, held)
  const rampField = ramp && rampEncodingOf(encoding)?.field
  const fillSet =
    field !== undefined ||
    rampField !== undefined ||
    typeof encoding === 'string'
  // #region contextVariableRead
  // the slot as written, not resolved: a jexl color read without a feature
  // evaluates against an empty context and hands back the fallout (adr-066)
  const utrConstant =
    utrColor === undefined
      ? fillSet
        ? undefined
        : cssColorToABGR(utrDefaultColor)
      : isJexl(utrColor)
        ? undefined
        : cssColorToABGR(String(utrColor))
  const utr = (feature: Feature, fill: PaintedFill) =>
    utrConstant ??
    (utrColor === undefined
      ? fill.packed
      : memo(utrByFeature, feature.id(), () =>
          cssColorToABGR(
            String(
              readConfObject(conf, ['utrs', 'encoding', 'color', 'value'], {
                feature,
              }),
            ),
          ),
        ))
  // #endregion

  if (field) {
    const keyed = (key: string) =>
      memo(byKey, key, () => {
        const css = field.color(key)
        return { css, packed: cssColorToABGR(css), key }
      })
    const read =
      field.field === CLUSTER_FIELD ? undefined : fieldReader(field.field, jexl)
    return {
      fill: (feature, cluster) =>
        read
          ? memo(byFeature, feature.id(), () => keyed(field.key(read(feature))))
          : keyed(field.key(cluster)),
      utr,
    }
  }
  if (ramp && rampField !== undefined) {
    const read = fieldReader(rampField, jexl)
    return {
      fill: feature =>
        memo(byFeature, feature.id(), () =>
          painted(ramp.colorOf(readText(read, feature))),
        ),
      utr,
    }
  }
  const value = typeof encoding === 'string' ? encoding : featureDefaultColor
  const constant = isJexl(value) ? undefined : painted(value)
  const { color } = conf.encoding
  return {
    fill: feature =>
      constant ??
      memo(byFeature, feature.id(), () =>
        painted(String(readConfObject(color, 'value', { feature }))),
      ),
    utr,
  }
}
