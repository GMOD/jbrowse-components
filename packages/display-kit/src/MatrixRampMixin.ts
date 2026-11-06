import { getConf, setConf } from '@jbrowse/core/configuration'
import { cssColorToRgba } from '@jbrowse/core/util/colorBits'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import {
  thresholdCuts,
  thresholdKeyEntries,
} from '@jbrowse/core/util/thresholdScale'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { COLOR_RAMP_LUT_ENTRIES } from '@jbrowse/render-core/colorRampLut'
import {
  SCALE_TYPE_LINEAR,
  denormalizeScore,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'
import { compareStructural } from 'mobx'

import {
  colorForScheme,
  colorSettingOf,
  matrixColorEncodingOf,
} from './colorConfigSchema.ts'

import type { ColorLegendSetting } from './colorConfigSchema.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ColorSlots, FieldPreset } from '@jbrowse/core/util/colorScale'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { ContinuousRef } from '@jbrowse/core/util/markEncoding'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

type RampScale = ContinuousRef['scale']

/** A matrix field's ramp: every field names its scheme, so a cell is never unpainted by an unset one. */
export type MatrixFieldPresets<F extends string> = Readonly<
  Record<
    F,
    FieldPreset<RampScale> & {
      scale: FieldPreset<RampScale>['scale'] & { scheme: ColorSchemeName }
    }
  >
>

export interface MatrixColorEncoding<F extends string> extends ContinuousRef {
  field: F
  scheme: ColorSchemeName
}

/** `encoding.color` as every matrix painter reads it: the GPU's uniforms and texture, the Canvas2D fill. */
export interface MatrixColorState {
  domain: readonly [number, number]
  scaleType: ScaleTypeCode
  /** where `domainMid` sits on the normalized ramp, 0.5 unset */
  midNorm: number
  /** `colorRamp`, the 256-entry table */
  ramp: Uint8Array
}

// Every display composing this is a BaseDisplay whose schema has an
// `encoding.color` over the presets' fields, which the mixin's own `self`
// cannot see.
const confNode = (self: object) =>
  self as { configuration: AnyConfigurationModel }

const UNIT_EXTENT = [0, 1] as const

/** A threshold scale's intervals: the cuts ascending, and one color more than cuts. */
export interface MatrixColorBins {
  cuts: readonly number[]
  colors: readonly string[]
}

function thresholdBins(
  domain: readonly string[],
  range: readonly string[],
  ramp: Uint8Array,
): MatrixColorBins {
  const cuts = thresholdCuts(domain)
  const sampled = stopsFromRampLut(ramp, cuts.length + 1)
  return { cuts, colors: sampled.map((stop, i) => range[i] ?? stop.color) }
}

/**
 * Equal bands, one per color. Entry i is the color at `i / (N - 1)`, so while
 * there are fewer than 128 bands a band's centre sits more than one entry
 * inside it, and the GPU's linear sample there blends only that band's
 * entries.
 */
function bandedLut(colors: readonly string[]) {
  const rgba = colors.map(c => cssColorToRgba(c))
  const last = COLOR_RAMP_LUT_ENTRIES - 1
  const lut = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)
  for (let i = 0; i < COLOR_RAMP_LUT_ENTRIES; i++) {
    lut.set(
      rgba[Math.min(rgba.length - 1, Math.floor((i / last) * rgba.length))]!,
      i * 4,
    )
  }
  return lut
}

/** A threshold's key rows, the highest interval first under `descending`. */
function thresholdKey(bins: MatrixColorBins, descending: boolean | undefined) {
  const entries = thresholdKeyEntries(bins.cuts, bins.colors, {})
  return descending ? entries.toReversed() : entries
}

/**
 * Each value as the painters read it under `bins`: the centre of its
 * interval's band of the banded table, so the bin a value falls in is decided
 * here, exactly, and not by where a 256-entry table rounds it. A value
 * `isValue` refuses, a matrix's no-data sentinel, stays as it is.
 */
export function binnedColorValues(
  values: Float32Array,
  { cuts, colors }: MatrixColorBins,
  isValue: (v: number) => boolean,
) {
  const out = new Float32Array(values.length)
  const n = colors.length
  for (let k = 0; k < values.length; k++) {
    const v = values[k]!
    let bin = 0
    while (bin < cuts.length && v >= cuts[bin]!) {
      bin++
    }
    out[k] = isValue(v) ? (bin + 0.5) / n : v
  }
  return out
}

/**
 * #stateModel MatrixRampMixin
 * #category display
 * #crossCuttingMixin A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), the domain and middle stop it spans over the display's `colorExtent` (`colorDomain`, `colorMidNorm`), all four as the painters read them (`matrixColor`), the legend's ramp (`rampColorScales`), and the scheme pick (`setColorScheme`). Under a `threshold` scale the intervals (`colorBins`) paint through a table of one band each, the display handing the painters each value at its interval's centre (`binnedColorValues`), and the key lists the intervals. A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`; one whose values follow the data, rather than a statistic's fixed range, answers `colorExtent`
 */
export default function MatrixRampMixin<F extends string>(
  presets: MatrixFieldPresets<F>,
) {
  return types
    .model('MatrixRampMixin', {})
    .views(self => ({
      /**
       * #getter
       * Overridable hook: the field the loaded cells are, the written one
       * unless the display overrides it with what the file served.
       */
      get paintedColorField(): F {
        return getConf(confNode(self), ['encoding', 'color', 'field'])
      },
      /**
       * #getter
       * Overridable hook: what an unset end of the domain follows, the unit
       * interval unless the display overrides it with its loaded values.
       */
      get colorExtent(): readonly [number, number] {
        return UNIT_EXTENT
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `encoding.color`'s painted members as written.
       */
      get paintedColorSetting() {
        return colorSettingOf(confNode(self).configuration.encoding.color)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The color channel under the painted field's preset, with an unset
       * `scale.reverse` turning round a scheme dark at its low end, since an
       * unpainted cell is the page behind the matrix. The preset's scheme,
       * and its direction with it, fill whichever continuous scale is
       * written: `withPreset` drops a preset whose scale differs, which would
       * leave the Log toggle painting no field's scheme, or observed/expected's
       * enrichment blue.
       */
      get colorEncoding(): MatrixColorEncoding<F> {
        const field = self.paintedColorField
        const written = self.paintedColorSetting
        const preset = presets[field].scale
        // a threshold paints through `colorBins`; the ramp under it stays the
        // field's, which an unwritten `range` samples
        return matrixColorEncodingOf(
          {
            ...written,
            field,
            scale: {
              ...written.scale,
              type:
                written.scale.type === 'threshold'
                  ? undefined
                  : written.scale.type,
              scheme: written.scale.scheme ?? preset.scheme,
              reverse:
                written.scale.reverse ??
                (written.scale.scheme === undefined
                  ? preset.reverse
                  : undefined),
            },
          },
          presets,
        ) as MatrixColorEncoding<F>
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorScaleType(): RampScale {
        return self.colorEncoding.scale
      },
      /**
       * #getter
       */
      get colorScheme(): ColorSchemeName {
        return self.colorEncoding.scheme
      },
      /**
       * #getter
       * `scale.reverse`, or where unset whether the scheme runs dark at its
       * low end.
       */
      get colorReverse(): boolean {
        return !!self.colorEncoding.reverse
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The scheme's 256 entries, read off `colorScheme` and `colorReverse`
       * rather than the encoding, so a domain edit re-uploads no texture.
       */
      get schemeRamp(): Uint8Array {
        return rampLutOf({
          scheme: self.colorScheme,
          reverse: self.colorReverse,
        })
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Under a `threshold` scale, its intervals: the `domain` cuts and a
       * `range` color each, an interval `range` leaves unnamed sampling the
       * scheme evenly from its low end.
       */
      get colorBins(): MatrixColorBins | undefined {
        const { scale } = self.paintedColorSetting
        return scale.type === 'threshold'
          ? thresholdBins(scale.domain, scale.range, self.schemeRamp)
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The 256 entries the GPU's texture, the Canvas2D fill and the legend
       * read: the scheme's ramp, or under a threshold one band per interval.
       */
      get colorRamp(): Uint8Array {
        const bins = self.colorBins
        return bins ? bandedLut(bins.colors) : self.schemeRamp
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `colorEncoding` over `colorExtent`: each pinned end holds and an open
       * one follows the extent, as the mark display's ramps do.
       */
      get colorScale() {
        return continuousColorScale(self.colorEncoding, self.colorExtent)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorDomain(): [number, number] {
        return self.colorScale.domain
      },
      /**
       * #getter
       * Where `domainMid` sits on the normalized ramp, 0.5 unset, so a
       * diverging scheme centres on it and equal distances from it take equal
       * colors.
       */
      get colorMidNorm(): number {
        return self.colorScale.midNorm
      },
      /**
       * #getter
       */
      get matrixColor(): MatrixColorState {
        return self.colorBins
          ? {
              domain: UNIT_EXTENT,
              scaleType: SCALE_TYPE_LINEAR,
              midNorm: 0.5,
              ramp: self.colorRamp,
            }
          : {
              domain: self.colorScale.domain,
              scaleType: scaleTypeCode(self.colorScaleType),
              midNorm: self.colorScale.midNorm,
              ramp: self.colorRamp,
            }
      },
      /**
       * #getter
       * The painted field's own key title, from its preset.
       */
      get colorFieldTitle(): string {
        return presets[self.paintedColorField].legend?.title ?? ''
      },
      /**
       * #method
       * The legend's ramp, once there is a domain to span: its bottom where
       * the scale paints it, a log scale's floor included, titled by
       * `encoding.color.legend.title` where written, else `title`; under a
       * threshold, its intervals, highest first under `legend.descending`. An end of
       * the domain the loaded values run past reads `≤` or `≥`; an unset
       * `min` is the key's own bottom.
       */
      rampColorScales({
        id,
        title,
        extent: { min, max },
      }: {
        id: string
        title: string
        extent: { min?: number; max: number }
      }): ColorScale[] {
        const { domain, midNorm } = self.colorScale
        const [lo, hi] = domain
        const bottom = denormalizeScore(
          0,
          lo,
          hi,
          scaleTypeCode(self.colorScaleType),
          1,
        )
        // the key's own members, which nothing that paints reads
        const legend: ColorLegendSetting = getConf(confNode(self), [
          'encoding',
          'color',
          'legend',
        ])
        const bins = self.colorBins
        return bins
          ? [
              {
                kind: 'categorical',
                id,
                title: legend.title ?? title,
                entries: thresholdKey(bins, legend.descending),
              },
            ]
          : hi > bottom
            ? [
                {
                  kind: 'ramp',
                  id,
                  title: legend.title ?? title,
                  domain: [bottom, hi],
                  stops: stopsFromRampLut(self.colorRamp, 11, midNorm),
                  extent: [min ?? bottom, max],
                },
              ]
            : []
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The scheme, with `reverse` back to unset so it follows the scheme.
       * The painted field's own scheme writes `scheme` unset, so it keeps
       * following the field.
       */
      setColorScheme(scheme: ColorSchemeName) {
        const node = confNode(self)
        const written = getSnapshot<ColorSlots>(
          node.configuration.encoding.color,
        )
        const next = colorForScheme(
          written,
          scheme,
          presets[self.paintedColorField].scale.scheme,
        )
        if (!compareStructural(next, written)) {
          setConf(node, ['encoding', 'color'], next)
        }
      },
    }))
}
