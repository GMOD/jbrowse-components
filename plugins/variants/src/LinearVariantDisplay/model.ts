import { getDialogHost } from '@jbrowse/core/util'
import { createAdapterMetadataFetch } from '@jbrowse/core/util/adapterMetadata'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'
import { types } from '@jbrowse/mobx-state-tree'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the canvas base display model would undo that display's lazy loading.
// This module is itself only reached through LinearVariantDisplay's own loader.
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
import {
  SV_TYPE_COLOR_JEXL,
  SV_TYPE_FIELD,
  svTypeLegendEntries,
} from '../shared/variantSvType.ts'
import { breakendMenuItems } from './breakendMenu.ts'
import { VARIANT_CHANNEL_SPEC_EXAMPLES } from './channelSpecExamples.ts'
import { presetColorOf } from './presetColor.ts'

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
       * The canvas resolver, with the `impact` and `svType` preset fields
       * resolved to the jexl colours that compute them.
       */
      get colorEncoding() {
        return (
          presetColorOf(self.colorSettings) ??
          colorEncodingOf(self.colorSettings, 'categorical')
        )
      },
      /**
       * #getter
       * The attribute the Attribute dialog opens on, '' under a preset.
       */
      get colorByAttribute(): string {
        return presetColorOf(self.colorSettings) ? '' : self.colorSettings.field
      },
    }))
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      const superRpcProps = self.rpcProps
      return {
        /**
         * #method
         * The canvas payload with a preset field sent as the jexl colour it
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
         * opens the split view for it. Super-captured rather than replaced, so
         * every generic row (details, zoom to, highlight, show/hide, copy)
         * stays where a reader already learned it.
         */
        contextMenuItems(): MenuItem[] {
          return [...superContextMenuItems(), ...breakendMenuItems(self)]
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       * Renames the shared canvas vocabulary for this display: every menu row,
       * chip and indicator that names what the track holds reads this, so a
       * variant track says "Variant height", "Hide this variant", "Showing 3
       * variants" instead of inheriting the gene-oriented "feature". The
       * per-hit noun in the context menu still comes from the annotation's own
       * type where it has one.
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
       */
      get colorsBySvType() {
        return self.colorEncoding === SV_TYPE_COLOR_JEXL
      },
      /**
       * #getter
       */
      get channelSpecExamples() {
        return VARIANT_CHANNEL_SPEC_EXAMPLES
      },
      /**
       * #getter
       * `LegendMixin`'s hook: the scale of whichever preset coloring is active
       * (impact tiers or SV classes), or else the key a color by a field
       * derives. SV-type shows the fixed class key and the grey everything
       * else takes; a copy-number state's rainbow color is the one thing it
       * paints and cannot list, the pure jexl having no present-set to
       * enumerate.
       */
      get colorScales(): ColorScale[] {
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
        if (this.colorsBySvType) {
          return [
            {
              kind: 'categorical',
              id: 'svType',
              title: 'SV type',
              entries: svTypeLegendEntries(),
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
       */
      // Variants have no UTRs and no strand, so drop the base's "Strand" radio
      // and open the solid-color dialog without the gene-oriented UTR row. Add
      // one-click "consequence impact" (SnpEff ANN / VEP CSQ) and "SV type"
      // presets. The inherited colorMenuItems() wraps these in the same "Color
      // by..." entry.
      //
      // Its own block, after the two getters it reads, so it reaches them
      // through `self`. This is a documented extension seam, and a subclass
      // super-captures a seam by destructuring it — at which point `this` is
      // undefined and the method throws. Same rule and same reason as
      // `isGeneLike`'s (pluginFacingDisplayApi.test.ts); a getter is safe with
      // `this` because it is always read through a receiver, a method is not.
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
                self.setColorScale()
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
            checked: self.colorByMode === 'attribute',
            keepMenuOpen: false,
            onClick: () => {
              self.openColorByAttributeDialog()
            },
          },
          {
            label: 'Solid color...',
            onClick: () => {
              self.openSetColorDialog()
            },
          },
        ]
      },
    }))
    .actions(self => {
      const fetchMetadata = createAdapterMetadataFetch(self)
      return {
        /**
         * #action
         */
        // Same dialog as the base display's, seeded with the VCF vocabulary
        // instead of the GFF one — see VARIANT_FILTER_EXAMPLES. Overridden
        // rather than parameterized on the base because the two multi-sample
        // displays and LD want the same list and none of them descends from it.
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
