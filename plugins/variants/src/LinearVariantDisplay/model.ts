import { types } from '@jbrowse/mobx-state-tree'
import { linearCanvasBaseDisplayStateModelFactory } from '@jbrowse/plugin-canvas'

import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  IMPACT_TIERS,
} from '../shared/variantConsequence.ts'
import {
  PREDEFINED_SV_TYPES,
  SV_TYPE_COLOR_JEXL,
} from '../shared/variantSvType.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

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
    .volatile(() => ({
      /**
       * #volatile
       */
      colorLegendDismissed: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setColorLegendDismissed(arg: boolean) {
        self.colorLegendDismissed = arg
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get featureWidgetType() {
        return VARIANT_FEATURE_WIDGET
      },
      /**
       * #getter
       */
      // True when features are colored by their most severe consequence impact.
      get colorsByConsequenceImpact() {
        return self.conf.color === CONSEQUENCE_IMPACT_JEXL
      },
      /**
       * #getter
       */
      // True when features are colored by their structural-variant class.
      get colorsBySvType() {
        return self.conf.color === SV_TYPE_COLOR_JEXL
      },
      /**
       * #getter
       */
      // Legend rows for whichever preset color key is active (impact tiers or SV
      // classes), or none. SV-type shows the fixed class key; copy-number and
      // unrecognized tokens aren't listed (the pure jexl has no present-set).
      get colorLegendItems(): LegendItem[] {
        if (this.colorsByConsequenceImpact) {
          return IMPACT_TIERS.map(t => ({ color: t.color, label: t.tier }))
        }
        if (this.colorsBySvType) {
          return PREDEFINED_SV_TYPES.map(t => ({ color: t.color, label: t.label }))
        }
        return []
      },
      /**
       * #getter
       */
      // Show the floating color key while a preset coloring is active, unless
      // the user dismissed it.
      get showColorLegend() {
        return this.colorLegendItems.length > 0 && !self.colorLegendDismissed
      },

      /**
       * #method
       */
      // Variants have no UTRs and no strand, so drop the base's "Strand" radio
      // and open the solid-color dialog without the gene-oriented UTR row. Add
      // one-click "consequence impact" (SnpEff ANN / VEP CSQ) and "SV type"
      // presets. The inherited colorMenuItems() wraps these in the same "Color
      // by..." entry.
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
            label: 'Consequence impact',
            type: 'radio' as const,
            checked: this.colorsByConsequenceImpact,
            onClick: () => {
              self.setColorLegendDismissed(false)
              self.setFeatureColor(CONSEQUENCE_IMPACT_JEXL)
            },
          },
          {
            label: 'SV type',
            type: 'radio' as const,
            checked: this.colorsBySvType,
            onClick: () => {
              self.setColorLegendDismissed(false)
              self.setFeatureColor(SV_TYPE_COLOR_JEXL)
            },
          },
          {
            label: 'Attribute...',
            type: 'radio' as const,
            checked:
              self.colorByMode === 'attribute' &&
              !this.colorsByConsequenceImpact &&
              !this.colorsBySvType,
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
