import { types } from '@jbrowse/mobx-state-tree'
import { linearCanvasBaseDisplayStateModelFactory } from '@jbrowse/plugin-canvas'

import { exportRCode } from './exportRCode.ts'
import { VARIANT_FEATURE_WIDGET } from '../shared/constants.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  IMPACT_TIERS,
} from '../shared/variantConsequence.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  LegendItem,
  RTrackFragment,
} from '@jbrowse/plugin-linear-genome-view'

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
      impactLegendDismissed: false,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setImpactLegendDismissed(arg: boolean) {
        self.impactLegendDismissed = arg
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
      // Legend rows for the impact color key (one per tier).
      get impactLegendItems(): LegendItem[] {
        return IMPACT_TIERS.map(t => ({ color: t.color, label: t.tier }))
      },
      /**
       * #getter
       */
      // Show the floating impact legend while that coloring is active, unless
      // the user dismissed it.
      get showImpactLegend() {
        return this.colorsByConsequenceImpact && !self.impactLegendDismissed
      },

      /**
       * #method
       */
      // Variants have no UTRs and no strand, so drop the base's "Strand" radio
      // and open the solid-color dialog without the gene-oriented UTR row. Add a
      // one-click "consequence impact" choice (SnpEff ANN / VEP CSQ). The
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
            label: 'Consequence impact',
            type: 'radio' as const,
            checked: this.colorsByConsequenceImpact,
            onClick: () => {
              self.setImpactLegendDismissed(false)
              self.setFeatureColor(CONSEQUENCE_IMPACT_JEXL)
            },
          },
          {
            label: 'Attribute...',
            type: 'radio' as const,
            checked:
              self.colorByMode === 'attribute' &&
              !this.colorsByConsequenceImpact,
            onClick: () => {
              self.openColorByAttributeDialog()
            },
          },
        ]
      },
    }))
    .views(self => ({
      /**
       * #method
       * Build the R ggplot fragment for this track, used by the view's "Export
       * R script" to regenerate the variant panel from source in ggplot2.
       */
      exportRCode(): RTrackFragment {
        return exportRCode(self as LinearVariantDisplayModel)
      },
    }))
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
