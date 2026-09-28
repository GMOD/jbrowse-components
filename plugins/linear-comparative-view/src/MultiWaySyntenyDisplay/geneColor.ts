import { readConfObject } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { colorFieldOf } from '@jbrowse/display-kit/colorConfigSchema'

import type { MultiWaySyntenyDisplayConfig } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type {
  ColorSetting,
  FieldColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'

/** paints each gene and box by its ortholog group, one colour down the stack */
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

/** Resolves a fill once per feature or value. Only `cluster` fields read `cluster`. */
export interface GeneColors {
  fill: (feature: Feature, cluster: string | undefined) => PaintedFill
  utr: (feature: Feature) => number
}

function memo<K, V>(map: Map<K, V>, key: K, make: () => V) {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

/** `encoding` is `geneColorEncoding`; `utrColor` is the slot as written. */
export function geneColors(
  conf: MultiWaySyntenyDisplayConfig,
  encoding: string | undefined | FieldColorEncoding,
  utrColor: unknown,
  jexl: JexlInstance,
): GeneColors {
  const byCss = new Map<string, PaintedFill>()
  const byKey = new Map<string, PaintedFill>()
  const byFeature = new Map<string, PaintedFill>()
  const utrByFeature = new Map<string, number>()
  const painted = (css: string) =>
    memo(byCss, css, () => ({ css, packed: cssColorToABGR(css) }))

  // #region contextVariableRead
  // the slot as written, not resolved: a jexl colour read without a feature
  // evaluates against an empty context and hands back the fallout (adr-066)
  const utrConstant = isJexl(utrColor)
    ? undefined
    : cssColorToABGR(String(utrColor))
  const utr = (feature: Feature) =>
    utrConstant ??
    memo(utrByFeature, feature.id(), () =>
      cssColorToABGR(String(readConfObject(conf, 'utrColor', { feature }))),
    )
  // #endregion

  const field = colorFieldOf(encoding)
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
  const value = typeof encoding === 'string' ? encoding : featureDefaultColor
  const constant = isJexl(value) ? undefined : painted(value)
  return {
    fill: feature =>
      constant ??
      memo(byFeature, feature.id(), () =>
        painted(String(readConfObject(conf, ['color', 'value'], { feature }))),
      ),
    utr,
  }
}
