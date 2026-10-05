import { dealKeyColors } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { colorNotices, withPreset } from '@jbrowse/core/util/colorScale'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { quantileExtent } from '@jbrowse/core/util/quantileExtent'
import { rampGapScales } from '@jbrowse/core/util/thresholdScale'
import {
  FEATURE_FIELD_PRESETS,
  categoricalColorField,
  colorFieldOf,
  colorSnapshotOf,
  featureColorEncoding,
  identityKeyEntries,
} from '@jbrowse/display-kit/colorConfigSchema'
import { heldColorSlots } from '@jbrowse/display-kit/heldColorSlots'
import { stableIdentityComputed } from '@jbrowse/display-kit/stableIdentityComputed'

import { createFieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import { workerColorOf } from '../RenderFeatureDataRPC/renderConfig.ts'

import type { FieldPalette } from '../RenderFeatureDataRPC/colorClasses.ts'
import type { WorkerColor } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { ColorValues } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type {
  ColorSetting,
  colorConfigSchema,
} from '@jbrowse/display-kit/colorConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface FeatureColorHost {
  conf: { color: Instance<typeof colorConfigSchema> }
  rpcDataMap: ReadonlyMap<
    number,
    {
      colorValues?: Pick<ColorValues, 'field' | 'values'>
      /** each box's one-based index into `colorValues.values`, 0 unpainted */
      rectColorValues: Uint32Array | undefined
    }
  >
}

// The value text a ramp reads: blank is no number, where `Number` reads 0.
function numericText(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

const NO_EXTENT: [number, number] = [Infinity, -Infinity]

// Enough to read the ramp's shape without the bar becoming a table of stops.
const RAMP_KEY_STOPS = 8

function featureColorSettingOf({
  conf: { color },
}: FeatureColorHost): ColorSetting {
  return colorSnapshotOf(color)
}

// Each painted box's value, the region's own boxes where it ships their
// indices and its distinct values otherwise: what a percentile weighs, so a
// value a thousand boxes paint counts a thousand times.
function paintedValues(
  { values }: Pick<ColorValues, 'values'>,
  boxes: Uint32Array | undefined,
) {
  const numbers = values.map(numericText)
  return boxes && boxes.length > 0
    ? Array.from(boxes, i => (i > 0 ? numbers[i - 1]! : Number.NaN))
    : numbers
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
    featureColorEncoding(featureColorSettingOf(self)),
  )
  const loaded = stableIdentityComputed(() => {
    const current = encoding.get()
    const field = typeof current === 'object' ? current.field : undefined
    const quantile =
      typeof current === 'object' &&
      (current.scale === 'linear' || current.scale === 'log')
        ? (current.domainQuantile ?? 1)
        : 1
    let min = Infinity
    let max = -Infinity
    let missing = false
    let notNumber = false
    const weighed: number[] = []
    for (const { colorValues, rectColorValues } of self.rpcDataMap.values()) {
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
        if (quantile < 1) {
          for (const value of paintedValues(colorValues, rectColorValues)) {
            weighed.push(value)
          }
        }
      }
    }
    const extent: [number, number] =
      quantile < 1
        ? quantileExtent(weighed, weighed.length, quantile)
        : [min, max]
    return { extent, missing, notNumber }
  })
  return {
    /**
     * #getter
     * The `color` object as written, its `value` and `field` raw: either
     * may be a `jexl:` expression over a feature, which has none here.
     */
    get colorSettings(): ColorSetting {
      return featureColorSettingOf(self)
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
     * which a facet on the same field shares.
     */
    get colorField() {
      const encoding = this.colorEncoding
      return categoricalColorField(encoding, heldColorSlots(self, encoding))
    },

    /**
     * #getter
     * The field the color channel paints through a categorical or threshold
     * scale, a threshold's values filed under their bins.
     */
    get paintedColorField() {
      const encoding = this.colorEncoding
      return colorFieldOf(encoding, heldColorSlots(self, encoding))
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
     * The key's heading: the color's `title`, or its field's preset's, else
     * the field.
     */
    get colorKeyTitle(): string | undefined {
      return (
        withPreset(this.colorSettings, FEATURE_FIELD_PRESETS).title ??
        this.colorFieldName
      )
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
      const name = this.colorFieldName
      const field = this.colorRamp ? undefined : this.paintedColorField
      return paint && name !== undefined
        ? createFieldPalette(
            name,
            paint,
            field &&
              (values => {
                dealKeyColors(field, values.map(field.key))
              }),
          )
        : undefined
    },

    /**
     * #method
     * The key a ramp paints, under the caller's scale `id`: the bar over its
     * domain, and a row apiece for the values the ramp has no colour for. Both
     * displays composing this built it from the same three getters, so the
     * derivation is here rather than twice over.
     */
    rampColorScales(id: string): ColorScale[] {
      const ramp = this.colorRamp
      return ramp
        ? [
            {
              kind: 'ramp',
              id,
              title: this.colorKeyTitle,
              domain: ramp.domain,
              stops: stopsFromRampLut(ramp.lut, RAMP_KEY_STOPS, ramp.midNorm),
              extent: this.colorValueExtent,
            },
            ...rampGapScales(`${id}-gaps`, this.colorValueGaps),
          ]
        : []
    },

    /**
     * #getter
     * What the `color` object's slots say together that it cannot paint as
     * written.
     */
    get colorNotices(): string[] {
      return colorNotices(this.colorSettings, FEATURE_FIELD_PRESETS)
    },

    /**
     * #getter
     * The corner notice's lines: `colorNotices`, which a display with more
     * to say extends.
     */
    get notices(): string[] {
      return this.colorNotices
    },
  }
}
