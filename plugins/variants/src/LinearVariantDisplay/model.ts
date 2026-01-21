import { lazy } from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearFeatureDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const MAFFilterDialog = lazy(
  () => import('../shared/components/MAFFilterDialog.tsx'),
)

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
         */
        minorAlleleFrequencyFilter: types.optional(types.number, 0),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      setMafFilter(value: number) {
        self.minorAlleleFrequencyFilter = value
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
          return [
            ...superFilterMenuItems(),
            {
              label: 'Minor allele frequency',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  MAFFilterDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
          ]
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { minorAlleleFrequencyFilter, ...rest } = snap as Omit<
        typeof snap,
        symbol
      >
      return {
        ...rest,
        ...(minorAlleleFrequencyFilter ? { minorAlleleFrequencyFilter } : {}),
      } as typeof snap
    })
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
