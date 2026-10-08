import { getDialogHost } from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { SV_TYPE_FIELD } from '@jbrowse/core/util/categoricalField'
import { solidColorItem } from '@jbrowse/display-kit/colorByMenu'
import { featureColorEncoding } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the canvas base display model would undo that display's lazy loading
import linearCanvasBaseDisplayStateModelFactory from '@jbrowse/plugin-canvas/LinearBasicDisplay/baseStateModel'

import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'
import { JexlFilterDialog } from '../shared/lazyDialogs.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  IMPACT_FIELD,
  IMPACT_TIERS,
  UNANNOTATED_IMPACT,
  getImpactColor,
} from '../shared/variantConsequence.ts'
import { VARIANT_FILTER_EXAMPLES } from '../shared/variantFilterExamples.ts'
import { variantFilterFields } from '../shared/variantFilterFields.ts'
import { breakendMenuItems } from './breakendMenu.ts'
import { presetColorOf } from './presetColor.ts'
import { sortReadsMenuItems } from './sortReadsMenu.ts'

import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
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
      /**
       * #getter
       * The canvas resolver, with the `impact` preset field resolved to the
       * jexl color that computes it.
       */
      get colorEncoding() {
        return (
          presetColorOf(self.colorSettings) ??
          featureColorEncoding(self.colorSettings)
        )
      },
      /**
       * #getter
       */
      get colorsBySvType() {
        return (
          self.colorSettings.field === SV_TYPE_FIELD &&
          self.colorSettings.scale !== 'none'
        )
      },
      /**
       * #getter
       * The attribute the Attribute dialog opens on, '' under a preset or the
       * SV type, each of which has its own row.
       */
      get colorByAttribute(): string {
        return presetColorOf(self.colorSettings) || this.colorsBySvType
          ? ''
          : self.colorSettings.field
      },
    }))
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      const superRpcProps = self.rpcProps
      return {
        /**
         * #method
         * The canvas payload with a preset field sent as the jexl color it
         * resolves to, since the worker reads the raw `color` object.
         */
        rpcProps() {
          const props = superRpcProps()
          const preset = presetColorOf(self.colorSettings)
          return preset
            ? {
                ...props,
                displayConfig: {
                  ...props.displayConfig,
                  color: {
                    ...props.displayConfig.color,
                    value: preset,
                    field: '',
                  },
                },
              }
            : props
        },
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
    .views(self => ({
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
      // #region sameBlockThis
      /**
       * #getter
       */
      get colorsByConsequenceImpact() {
        return self.colorEncoding === CONSEQUENCE_IMPACT_JEXL
      },
      /**
       * #getter
       * The key while features draw: the impact tiers under that preset, or
       * else the key a color by a field derives.
       */
      get featureColorScales(): ColorScale[] {
        if (this.colorsByConsequenceImpact) {
          return [
            {
              kind: 'categorical',
              id: 'consequenceImpact',
              title: 'Consequence impact',
              entries: [
                ...IMPACT_TIERS.map(t => ({
                  value: t.tier,
                  label: t.tier,
                  color: t.color,
                })),
                {
                  value: UNANNOTATED_IMPACT,
                  label: UNANNOTATED_IMPACT,
                  color: getImpactColor(UNANNOTATED_IMPACT),
                },
              ],
            },
          ]
        }
        return self.derivedColorScales
      },
      // #endregion
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
                self.setFeatureColor(undefined)
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
            checked: self.colorByMode === 'attribute' && !self.colorsBySvType,
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
