import { getConf } from '@jbrowse/core/configuration'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import {
  FEATURE_FIELD_SCALES,
  categoricalColorField,
  colorFieldOf,
  colorMembersOf,
  colorScaleChoicesOf,
  featureColorEncoding,
} from '@jbrowse/display-kit/colorConfigSchema'
import { colorNotices, fieldScaleOf } from '@jbrowse/display-kit/colorScale'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { createFieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'

import type { FieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import type { ColorValues } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayConfigModel } from './baseConfigSchema.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface ColorHost {
  configuration: Instance<LinearCanvasBaseDisplayConfigModel>
  conf: Instance<LinearCanvasBaseDisplayConfigModel>
  rpcDataMap: ReadonlyMap<number, { colorValues?: ColorValues }>
}

// The value text a ramp reads: blank is no number, where `Number` reads 0.
function numericText(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

const NO_EXTENT: [number, number] = [Infinity, -Infinity]

export function colorViews(self: ColorHost) {
  // Compared by value, so a region that commits inside the extent, or a
  // key-only edit such as a title, hands the encode the same scale and
  // re-encodes nothing.
  const encoding = stableIdentityComputed(() =>
    featureColorEncoding(colorSettingsOf(self)),
  )
  const extent = stableIdentityComputed(() => {
    const current = encoding.get()
    const field = typeof current === 'object' ? current.field : undefined
    let min = Infinity
    let max = -Infinity
    for (const { colorValues } of self.rpcDataMap.values()) {
      if (colorValues && colorValues.field === field) {
        for (const text of colorValues.values) {
          const value = numericText(text)
          if (Number.isFinite(value)) {
            min = Math.min(min, value)
            max = Math.max(max, value)
          }
        }
      }
    }
    return [min, max] as [number, number]
  })
  return {
    /**
     * #getter
     */
    get showOutline() {
      return !!this.outlineColorSlot
    },

    /**
     * #getter
     * The `outlineColor` slot as written: `''`, `THEME_DERIVED_COLOR`, or a
     * literal, which `resolveOutlineColor` packs against a palette.
     */
    get outlineColorSlot(): string {
      return getConf(self, 'outlineColor')
    },

    /**
     * #getter
     */
    // Raw slot rather than getConf: a jexl color evaluated without a feature
    // throws, and a jexl string is no CSS color anyway.
    get featureColor() {
      const raw = self.conf.color.value
      return raw !== undefined && !isJexl(raw) ? raw : featureDefaultColor
    },

    /**
     * #getter
     * The field the color paints by, through any scale, or undefined while
     * `color.value` paints.
     */
    get colorFieldName(): string | undefined {
      const encoding = this.colorEncoding
      return typeof encoding === 'object' ? encoding.field : undefined
    },

    /**
     * #getter
     */
    get colorByMode(): 'default' | 'strand' | 'attribute' {
      const field = this.colorFieldName
      return field === undefined
        ? 'default'
        : field === STRAND_FIELD
          ? 'strand'
          : 'attribute'
    },

    /**
     * #getter
     */
    get colorByAttribute(): string {
      const { field } = this.colorSettings
      return field === STRAND_FIELD ? '' : field
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
     * The key's heading: the color's `title` where written, else the field.
     */
    get colorKeyTitle(): string | undefined {
      return this.colorSettings.title ?? this.colorFieldName
    },

    /**
     * #getter
     * The smallest and largest number the loaded regions' color field
     * values hold, which a ramp's open ends follow.
     */
    get colorValueExtent(): [number, number] {
      return extent.get()
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
     * The color a field value paints, while a field paints: what the
     * main-thread encode fills each box carrying that value with. A ramp
     * paints a box with no value the no-value grey, as the categorical and
     * threshold scales do.
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
      return colorNotices(
        settings,
        fieldScaleOf(FEATURE_FIELD_SCALES, settings.field),
      )
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

    /**
     * #getter
     * The `color` object as written, its `value` and `field` raw: either
     * may be a `jexl:` expression over a feature, which has none here.
     */
    get colorSettings(): ColorSetting {
      return colorSettingsOf(self)
    },
  }
}

function colorSettingsOf(self: ColorHost): ColorSetting {
  return {
    value: self.conf.color.value,
    field: self.conf.color.field,
    scale: getConf(self, ['color', 'scale']),
    domain: getConf(self, ['color', 'domain']),
    range: getConf(self, ['color', 'range']),
    scheme: getConf(self, ['color', 'scheme']),
    reverse: getConf(self, ['color', 'reverse']),
    domainMin: getConf(self, ['color', 'domainMin']),
    domainMax: getConf(self, ['color', 'domainMax']),
    domainMid: getConf(self, ['color', 'domainMid']),
    labels: getConf(self, ['color', 'labels']),
    title: getConf(self, ['color', 'title']),
  }
}
