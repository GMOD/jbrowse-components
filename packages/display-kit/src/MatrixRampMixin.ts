import { getConf, setConf } from '@jbrowse/core/configuration'
import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import {
  colorForScheme,
  colorSettingOf,
  matrixColorEncodingOf,
} from './colorConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSlots, FieldPreset } from '@jbrowse/core/util/colorScale'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { ContinuousRef } from '@jbrowse/core/util/markEncoding'

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

// Every display composing this is a BaseDisplay whose schema has an
// `encoding.color` over the presets' fields, which the mixin's own `self`
// cannot see.
const confNode = (self: object) =>
  self as { configuration: AnyConfigurationModel }

/**
 * #stateModel MatrixRampMixin
 * #category display
 * #crossCuttingMixin A matrix display's `encoding.color` as it paints: the painted field through its preset's ramp (`colorEncoding`), that ramp's scheme, direction and 256-entry table (`colorScheme`, `colorReverse`, `colorRamp`), and the scheme pick (`setColorScheme`). A display that may paint a field other than the written one, because the file could not serve it, answers `paintedColorField`. The domain stays the display's: one follows the loaded values, another spans its statistic's fixed range
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
    }))
    .views(self => ({
      /**
       * #getter
       * The color channel under the painted field's preset, with an unset
       * `scale.reverse` turning round a scheme dark at its low end, since an
       * unpainted cell is the page behind the matrix. The preset's scheme
       * fills whichever continuous scale is written: `withPreset` drops a
       * preset whose scale differs, which would leave the Log toggle painting
       * no field's scheme.
       */
      get colorEncoding(): MatrixColorEncoding<F> {
        const field = self.paintedColorField
        const written = colorSettingOf(
          confNode(self).configuration.encoding.color,
        )
        return matrixColorEncodingOf(
          {
            ...written,
            field,
            scale: {
              ...written.scale,
              scheme: written.scale.scheme ?? presets[field].scale.scheme,
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
