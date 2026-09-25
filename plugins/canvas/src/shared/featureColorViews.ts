import { readConfObject } from '@jbrowse/core/configuration'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import {
  FEATURE_FIELD_PRESETS,
  categoricalColorField,
  colorFieldOf,
  colorMembersOf,
  colorScaleChoicesOf,
  featureColorEncoding,
  identityKeyEntries,
} from '@jbrowse/display-kit/colorConfigSchema'
import { colorNotices } from '@jbrowse/display-kit/colorScale'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { createFieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import { workerColorOf } from '../RenderFeatureDataRPC/renderConfig.ts'

import type { FieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { ColorValues } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  ColorSetting,
  colorConfigSchema,
} from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface FeatureColorHost {
  conf: { color: Instance<typeof colorConfigSchema> }
  rpcDataMap: ReadonlyMap<
    number,
    { colorValues?: Pick<ColorValues, 'field' | 'values'> }
  >
}

// The value text a ramp reads: blank is no number, where `Number` reads 0.
function numericText(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

const NO_EXTENT: [number, number] = [Infinity, -Infinity]

function colorSettingsOf({ conf: { color } }: FeatureColorHost): ColorSetting {
  return {
    value: color.value,
    field: color.field,
    scale: readConfObject(color, 'scale'),
    domain: readConfObject(color, 'domain'),
    range: readConfObject(color, 'range'),
    scheme: readConfObject(color, 'scheme'),
    reverse: readConfObject(color, 'reverse'),
    domainMin: readConfObject(color, 'domainMin'),
    domainMax: readConfObject(color, 'domainMax'),
    domainMid: readConfObject(color, 'domainMid'),
    labels: readConfObject(color, 'labels'),
    title: readConfObject(color, 'title'),
  }
}

/**
 * A FeatureColor object read as the displays painting it read it: the scale
 * each field paints through, the colour a value the worker shipped paints,
 * the key's title, and what its slots say together that it cannot paint. The
 * canvas feature and multi-row displays compose it.
 */
export function featureColorViews(self: FeatureColorHost) {
  // Compared by value, so a region that commits inside the extent, or a
  // key-only edit such as a title, hands the encode the same scale and
  // re-encodes nothing.
  const encoding = stableIdentityComputed(() =>
    featureColorEncoding(colorSettingsOf(self)),
  )
  const loaded = stableIdentityComputed(() => {
    const current = encoding.get()
    const field = typeof current === 'object' ? current.field : undefined
    let min = Infinity
    let max = -Infinity
    let missing = false
    let notNumber = false
    for (const { colorValues } of self.rpcDataMap.values()) {
      if (colorValues && colorValues.field === field) {
        for (const text of colorValues.values) {
          const value = numericText(text)
          if (Number.isFinite(value)) {
            min = Math.min(min, value)
            max = Math.max(max, value)
          } else if (text === '') {
            missing = true
          } else if (Number.isNaN(value)) {
            notNumber = true
          }
        }
      }
    }
    return { extent: [min, max] as [number, number], missing, notNumber }
  })
  return {
    /**
     * #getter
     * The `color` object as written, its `value` and `field` raw: either
     * may be a `jexl:` expression over a feature, which has none here.
     */
    get colorSettings(): ColorSetting {
      return colorSettingsOf(self)
    },

    /**
     * #getter
     * The two members the worker reads, the rest being the main thread's.
     */
    get workerColor(): WorkerColor {
      return workerColorOf(self.conf.color)
    },

    /**
     * #getter
     * `colorSettings` as it paints, through the one resolver every display's
     * colour object goes through: `color.value`, or a field through its
     * scale, `score` a ramp and any other field categorical while `scale` is
     * unset.
     */
    get colorEncoding() {
      return encoding.get()
    },

    /**
     * #getter
     * The field the color paints by, through any scale, or undefined while
     * `color.value` paints.
     */
    get colorFieldName(): string | undefined {
      const current = this.colorEncoding
      return typeof current === 'object' ? current.field : undefined
    },

    /**
     * #getter
     * The color channel's field while it paints through a categorical scale,
     * which a facet on the same field shares and "Pin distinct colors"
     * writes the domain of.
     */
    get colorField() {
      return categoricalColorField(this.colorEncoding)
    },

    /**
     * #getter
     * The field the color channel paints through a categorical or threshold
     * scale, a threshold's values filed under their bins.
     */
    get paintedColorField() {
      return colorFieldOf(this.colorEncoding)
    },

    /**
     * #getter
     * The rows an identity scale's key names, empty under any other scale.
     */
    get identityKeyEntries() {
      return identityKeyEntries(this.colorSettings)
    },

    /**
     * #getter
     * The key's heading: the color's `title` where written, else the field.
     */
    get colorKeyTitle(): string | undefined {
      return this.colorSettings.title ?? this.colorFieldName
    },

    /**
     * #getter
     * The smallest and largest number the loaded regions' values of the
     * painting field hold, which a ramp's open ends follow.
     */
    get colorValueExtent(): [number, number] {
      return loaded.get().extent
    },

    /**
     * #getter
     * Whether a loaded feature holds no value in the painting field, or text
     * that is no number, which a ramp's key lists beside its bar.
     */
    get colorValueGaps(): { missing: boolean; notNumber: boolean } {
      const { missing, notNumber } = loaded.get()
      return { missing, notNumber }
    },

    /**
     * #getter
     * The ramp a linear or log color paints through, over the loaded
     * values where an end is left open.
     */
    get colorRamp() {
      const current = this.colorEncoding
      return typeof current === 'object' &&
        (current.scale === 'linear' || current.scale === 'log')
        ? continuousColorScale(
            current,
            current.domainMin !== undefined && current.domainMax !== undefined
              ? NO_EXTENT
              : this.colorValueExtent,
          )
        : undefined
    },

    /**
     * #getter
     * The color a field value paints, while a field paints. A ramp paints a
     * value-less feature the no-value grey, as the categorical and threshold
     * scales do.
     */
    get paintColorValue(): ((value: string) => string) | undefined {
      const ramp = this.colorRamp
      if (ramp) {
        return text =>
          text === ''
            ? NO_CATEGORY_COLOR
            : abgrToCssRgba(ramp.colorOf(numericText(text)))
      }
      const field = this.paintedColorField
      return field && (value => field.color(field.key(value)))
    },

    /**
     * #getter
     * `paintColorValue` with each value's packed colors held for every
     * region and re-encode that asks, while the scale stands.
     */
    get fieldPalette(): FieldPalette | undefined {
      const paint = this.paintColorValue
      const field = this.colorFieldName
      return paint && field !== undefined
        ? createFieldPalette(field, paint)
        : undefined
    },

    /**
     * #getter
     * What the `color` object's slots say together that it cannot paint as
     * written, for the corner notice.
     */
    get notices(): string[] {
      const settings = this.colorSettings
      return colorNotices(settings, FEATURE_FIELD_PRESETS)
    },

    /**
     * #getter
     * The scales this display's colour paints, for the Edit as JSON box.
     */
    get colorScaleChoices(): string[] {
      return colorScaleChoicesOf(self.conf.color)
    },

    /**
     * #getter
     * The members this display's colour object declares, for the Edit as
     * JSON box.
     */
    get colorMembers(): string[] {
      return colorMembersOf(self.conf.color)
    },
  }
}
