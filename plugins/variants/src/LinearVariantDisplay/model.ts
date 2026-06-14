import { types } from '@jbrowse/mobx-state-tree'
import { linearCanvasBaseDisplayStateModelFactory } from '@jbrowse/plugin-canvas'
import PaletteIcon from '@mui/icons-material/Palette'

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
        return {
          type: 'VariantFeatureWidget',
          id: 'variantFeature',
        }
      },

      /**
       * #method
       */
      // Variants have no UTRs, so drop the gene-oriented solid+UTR "Color"
      // picker and surface a single "Color by..." entry. Custom solid color is
      // still reachable via the "Solid color..." submenu option.
      colorMenuItems() {
        return [
          {
            label: 'Color by...',
            icon: PaletteIcon,
            subMenu: [
              {
                label: 'Solid color...',
                onClick: () => {
                  self.openSetColorDialog(false)
                },
              },
              ...self.colorBySubMenuItems({ strand: false }),
            ],
          },
        ]
      },
    }))
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
