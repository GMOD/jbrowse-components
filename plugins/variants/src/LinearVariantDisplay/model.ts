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
import { breakendMenuItems } from './breakendMenu.ts'

import type { LinearVariantDisplayConfigModel } from './configSchema.ts'
import type { MenuItem } from '@jbrowse/core/ui'
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
  configSchema: LinearVariantDisplayConfigModel,
) {
  return linearCanvasBaseDisplayStateModelFactory(configSchema)
    .props({
      /**
       * #property
       */
      type: types.literal('LinearVariantDisplay'),
    })
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
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
          return PREDEFINED_SV_TYPES.map(t => ({
            color: t.color,
            label: t.label,
          }))
        }
        return []
      },
      /**
       * #getter
       */
      // Whether a preset coloring is active, i.e. whether there is a key at all.
      // NOT anded with `colorLegendDismissed`: dismissal is the hook's own flag
      // (see CanvasColorLegend), so the track menu's "Show legend" checkbox can
      // offer the way back from the key's own "×".
      get showColorLegend() {
        // `this` for the sibling defined just above (same block), `self` for
        // what earlier blocks and the volatile added — see the MST patterns guide
        return this.colorLegendItems.length > 0
      },
      // #endregion

      /**
       * #getter
       * This display's answer to the base's `colorLegend` chrome hook: the shared
       * canvas body draws the key, so this display needs no component of its own
       * (its `ReactComponent` is the one LinearBasicDisplay registers).
       */
      get colorLegend() {
        return this.showColorLegend
          ? {
              items: this.colorLegendItems,
              dismissed: self.colorLegendDismissed,
              setDismissed: self.setColorLegendDismissed,
            }
          : undefined
      },
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
      // `isGeneLike`'s (pluginFacingDisplayApi.test.ts) and the base's
      // morphOffsetFor block; a getter is safe with `this` because it is always
      // read through a receiver, a method is not.
      colorBySubMenuItems() {
        return [
          {
            label: 'Solid color...',
            type: 'radio' as const,
            checked: self.colorByMode === 'solid',
            // the dialog openers here opt out of the checkbox/radio default and
            // dismiss; the setting radios between them keep the menu up
            keepMenuOpen: false,
            onClick: () => {
              self.openSetColorDialog(false)
            },
          },
          {
            label: 'Consequence impact',
            type: 'radio' as const,
            checked: self.colorsByConsequenceImpact,
            onClick: () => {
              self.setColorLegendDismissed(false)
              self.setFeatureColor(CONSEQUENCE_IMPACT_JEXL)
            },
          },
          {
            label: 'SV type',
            type: 'radio' as const,
            checked: self.colorsBySvType,
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
              !self.colorsByConsequenceImpact &&
              !self.colorsBySvType,
            keepMenuOpen: false,
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
