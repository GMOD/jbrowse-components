import { getDialogHost } from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { solidColorItem } from '@jbrowse/display-kit/colorByMenu'
import { types } from '@jbrowse/mobx-state-tree'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the canvas base display model would undo that display's lazy loading
import linearCanvasBaseDisplayStateModelFactory from '@jbrowse/plugin-canvas/LinearBasicDisplay/baseStateModel'

import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'
import { JexlFilterDialog } from '../shared/lazyDialogs.ts'
import { IMPACT_FIELD } from '../shared/variantConsequence.ts'
import { VARIANT_FILTER_EXAMPLES } from '../shared/variantFilterExamples.ts'
import { variantFilterFields } from '../shared/variantFilterFields.ts'
import { breakendMenuItems } from './breakendMenu.ts'
import { sortReadsMenuItems } from './sortReadsMenu.ts'

import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
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
  configSchema: LinearVariantDisplayConfigModel,
) {
  return linearCanvasBaseDisplayStateModelFactory(configSchema)
    .props({
      /**
       * #property
       */
      type: types.literal('LinearVariantDisplay'),
    })
    .views(self => ({
      // #region sameBlockThis
      /**
       * #getter
       */
      get colorsByConsequenceImpact() {
        return (
          self.colorSetting.field === IMPACT_FIELD &&
          self.colorSetting.scale !== 'none'
        )
      },
      /**
       * #getter
       */
      get colorsBySvType() {
        return (
          self.colorSetting.field === SV_TYPE_FIELD &&
          self.colorSetting.scale !== 'none'
        )
      },
      /**
       * #getter
       * The attribute the Attribute dialog opens on, '' under the impact or
       * SV type preset, each of which has its own row.
       */
      get colorByAttribute(): string {
        return this.colorsByConsequenceImpact || this.colorsBySvType
          ? ''
          : self.colorSetting.field
      },
      // #endregion
    }))
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
        /**
         * #method
         * The shared feature menu plus, on a breakend record, the row that
         * opens the split view for it, and beside a pileup the row that sorts
         * its reads at the variant.
         */
        contextMenuItems(): MenuItem[] {
          return [
            ...superContextMenuItems(),
            ...breakendMenuItems(self),
            ...sortReadsMenuItems(self),
          ]
        },
      }
    })
    .views(() => ({
      /**
       * #getter
       * Names what the track holds in every menu row, chip and indicator, so
       * a variant track says "Variant height" and "Showing 3 variants" rather
       * than "feature". The context menu's per-hit noun still comes from the
       * annotation's own type where it has one.
       */
      get featureNoun() {
        return 'variant'
      },
      /**
       * #getter
       */
      get featureWidgetType() {
        return VARIANT_FEATURE_WIDGET
      },
    }))
    .views(self => ({
      /**
       * #method
       * The Color by entries without the base's Strand radio, plus one-click
       * consequence impact (SnpEff ANN / VEP CSQ) and SV type presets.
       */
      // Its own block after the getters it reads, through `self`, never
      // `this`: a subclass super-captures this extension seam by destructuring,
      // which leaves `this` undefined (as `isGeneLike`,
      // pluginFacingDisplayApi.test.ts).
      colorBySubMenuItems() {
        const preset = self.colorsByConsequenceImpact || self.colorsBySvType
        return [
          {
            label: 'Default',
            type: 'radio' as const,
            checked: self.colorByMode === 'default' && !preset,
            onClick: () => {
              if (preset) {
                self.setColorValue(undefined)
              } else {
                self.pickDefaultColor()
              }
            },
          },
          {
            label: 'Consequence impact',
            type: 'radio' as const,
            checked: self.colorsByConsequenceImpact,
            onClick: () => {
              self.setShowLegend(true)
              self.colorByField(IMPACT_FIELD)
            },
          },
          {
            label: 'SV type',
            type: 'radio' as const,
            checked: self.colorsBySvType,
            onClick: () => {
              self.setShowLegend(true)
              self.colorByField(SV_TYPE_FIELD)
            },
          },
          {
            label: 'Attribute...',
            type: 'radio' as const,
            checked: self.colorByMode === 'attribute' && !preset,
            keepMenuOpen: false,
            onClick: () => {
              self.openColorByAttributeDialog()
            },
          },
          solidColorItem(self.colorByMode === 'solid', () => {
            self.pickSolidColor()
          }),
        ]
      },
    }))
    .actions(self => {
      const fetchMetadata = createAdapterMetadataFetch(self)
      return {
        /**
         * #action
         * The base display's filter dialog, seeded with the VCF vocabulary
         * (`VARIANT_FILTER_EXAMPLES`).
         */
        // Overridden rather than parameterized on the base: the other variant
        // displays want the same list and none descends from it.
        openFilterDialog() {
          getDialogHost(self).queueDialog(handleClose => [
            JexlFilterDialog,
            {
              model: self,
              handleClose,
              examples: VARIANT_FILTER_EXAMPLES,
              fields: variantFilterFields(fetchMetadata()),
            },
          ])
        },
      }
    })
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
