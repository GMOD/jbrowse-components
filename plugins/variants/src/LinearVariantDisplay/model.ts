import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearFeatureDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'

import { createMAFFilterMenuItem } from '../shared/mafFilterUtils.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LinearVariantDisplay
 * Similar to feature display, but provides custom widget on feature click.
 * Does not include gene glyph options since variants are not genes.
 * extends
 *
 * - [LinearFeatureDisplay](../linearfeaturedisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearFeatureDisplayModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * Minor allele frequency filter threshold (0-0.5)
         * When undefined, falls back to config value
         */
        minorAlleleFrequencyFilterSetting: types.maybe(types.number),
      }),
    )
    .views(self => ({
      /**
       * #getter
       * Gets the minor allele frequency filter threshold
       * Falls back to config value if setting is not defined
       */
      get minorAlleleFrequencyFilter() {
        return (
          self.minorAlleleFrequencyFilterSetting ??
          getConf(self, 'minorAlleleFrequencyFilter')
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMafFilter(value: number) {
        self.minorAlleleFrequencyFilterSetting = value
      },
    }))
    .views(self => {
      const {
        activeFilters: superActiveFilters,
        filterMenuItems: superFilterMenuItems,
      } = self
      return {
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
         * #getter
         * Override to add MAF filter to active filters
         */
        get activeFilters(): string[] {
          const filters = [...superActiveFilters]
          if (self.minorAlleleFrequencyFilter > 0) {
            filters.push(
              `jexl:maf(feature) >= ${self.minorAlleleFrequencyFilter}`,
            )
          }
          return filters
        },
        /**
         * #method
         */
        filterMenuItems() {
          return [...superFilterMenuItems(), createMAFFilterMenuItem(self)]
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { minorAlleleFrequencyFilterSetting, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      return {
        ...rest,
        ...(minorAlleleFrequencyFilterSetting
          ? { minorAlleleFrequencyFilterSetting }
          : {}),
      } as typeof snap
    })
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
