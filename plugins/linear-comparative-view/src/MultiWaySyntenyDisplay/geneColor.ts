import { readConfObject } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { categoricalColorField } from '@jbrowse/display-kit/colorConfigSchema'

import type { MultiWaySyntenyDisplayConfig } from './configSchema.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type {
  ColorSetting,
  FieldColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The structural field of the gene colour: a gene takes the ortholog group
 * it carries, and a placement box its own group, so one group is one colour
 * down the stack.
 */
export const CLUSTER_FIELD = 'cluster'

export interface PaintedFill {
  css: string
  packed: number
  /** the value a painting field filed the mark under; unset while `value` paints */
  key?: string
}

export interface GeneColorSettings {
  color: ColorSetting
  utrColor: unknown
}

/**
 * The fills one set of features paints, each resolved once for the object's
 * lifetime: a `jexl:` slot runs once per feature, and a field's colour once
 * per value. `cluster` is the claim the caller made, which only the cluster
 * field reads.
 */
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

/**
 * `encoding` is the gene `color` as it paints (`geneColorEncoding` on the
 * display), and `utrColor` the slot as written.
 */
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

  const field = categoricalColorField(encoding)
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
