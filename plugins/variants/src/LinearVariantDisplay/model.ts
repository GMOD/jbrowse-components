import { types } from '@jbrowse/mobx-state-tree'
import { linearCanvasBaseDisplayStateModelFactory } from '@jbrowse/plugin-canvas'

import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearVariantDisplay
 * GPU-accelerated variant display with custom feature widget on click.
 *
 * #example
 * A complete `VariantTrack` config to paste into `tracks`:
 * ```js
 * {
 *   type: 'VariantTrack',
 *   trackId: 'variants',
 *   name: 'Variants',
 *   assemblyNames: ['hg38'],
 *   adapter: {
 *     type: 'VcfTabixAdapter',
 *     uri: 'https://example.com/variants.vcf.gz',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearVariantDisplay',
 *       displayId: 'variants-LinearVariantDisplay',
 *       height: 150,
 *     },
 *   ],
 * }
 * ```
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return linearCanvasBaseDisplayStateModelFactory(configSchema)
    .props({
      /**
       * #property
       */
      type: types.literal('LinearVariantDisplay'),
    })
    .views(self => ({
      /**
       * #getter
       */
      get featureWidgetType() {
        return VARIANT_FEATURE_WIDGET
      },

      /**
       * #method
       */
      // Variants have no UTRs and no strand, so drop the base's "Strand" radio
      // and open the solid-color dialog without the gene-oriented UTR row. The
      // inherited colorMenuItems() wraps these in the same "Color by..." entry.
      colorBySubMenuItems() {
        return [
          {
            label: 'Solid color...',
            type: 'radio' as const,
            checked: self.colorByMode === 'solid',
            onClick: () => {
              self.openSetColorDialog(false)
            },
          },
          {
            label: 'Attribute...',
            type: 'radio' as const,
            checked: self.colorByMode === 'attribute',
            onClick: () => {
              self.openColorByAttributeDialog()
            },
          },
        ]
      },
    }))
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
