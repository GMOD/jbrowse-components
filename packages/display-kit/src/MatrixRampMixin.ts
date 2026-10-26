import { getConf, setConf } from '@jbrowse/core/configuration'
import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { continuousColorScale } from '@jbrowse/core/util/markEncoding'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'
import {
  denormalizeScore,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'

import {
  colorForScheme,
  colorSettingOf,
  matrixColorEncodingOf,
} from './colorConfigSchema.ts'

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

/**
 * #stateModel MatrixRampMixin
 * #category display
 * #crossCuttingMixin A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), the domain and middle stop it spans over the display's `colorExtent` (`colorDomain`, `colorMidNorm`), all four as the painters read them (`matrixColor`), the legend's ramp (`rampColorScales`), and the scheme pick (`setColorScheme`). A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`; one whose values follow the data, rather than a statistic's fixed range, answers `colorExtent`
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
        const written = colorSettingOf(
          confNode(self).configuration.encoding.color,
        )
        const preset = presets[field].scale
        return matrixColorEncodingOf(
          {
            ...written,
            field,
            scale: {
              ...written.scale,
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
       * The ramp's 256 entries: the GPU's texture, the Canvas2D fill and the
       * legend read this one table. It reads `colorScheme` and `colorReverse`
       * rather than the encoding, so a domain edit re-uploads no texture.
       */
      get colorRamp(): Uint8Array {
        return rampLutOf({
          scheme: self.colorScheme,
          reverse: self.colorReverse,
        })
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
        return {
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
       * `encoding.color.legend.title` where written, else `title`. An end of
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
        const written: string | undefined = getConf(confNode(self), [
          'encoding',
          'color',
          'legend',
          'title',
        ])
        return hi > bottom
          ? [
              {
                kind: 'ramp',
                id,
                title: written ?? title,
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
        const { color } = node.configuration.encoding
        setConf(
          node,
          ['encoding', 'color'],
          colorForScheme(
            getSnapshot<ColorSlots>(color),
            scheme,
            presets[self.paintedColorField].scale.scheme,
          ),
        )
      },
    }))
}
