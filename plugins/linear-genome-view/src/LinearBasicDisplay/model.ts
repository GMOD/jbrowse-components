import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { modelFactory as LinearFeatureDisplayModelFactory } from '../LinearFeatureDisplay/index.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem, SubMenuItem } from '@jbrowse/core/ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

function findSubMenu(items: MenuItem[], label: string) {
  return items.find(
    (item): item is SubMenuItem => 'label' in item && item.label === label,
  )
}

/**
 * #stateModel LinearBasicDisplay
 * #category display
 * Used by `FeatureTrack`, has simple settings like "show/hide feature labels",
 * plus gene glyph display options.
 *
 * extends
 * - [LinearFeatureDisplay](../linearfeaturedisplay)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearBasicDisplay',
      LinearFeatureDisplayModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearBasicDisplay'),
        /**
         * #property
         */
        trackGeneGlyphMode: types.maybe(types.string),
        /**
         * #property
         */
        trackSubfeatureLabels: types.maybe(types.string),
        /**
         * #property
         */
        trackDisplayDirectionalChevrons: types.maybe(types.boolean),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      /**
       * #getter
       */
      get geneGlyphMode() {
        return (
          self.trackGeneGlyphMode ??
          getConf(self, ['renderer', 'geneGlyphMode'])
        )
      },
      /**
       * #getter
       */
      get subfeatureLabels() {
        return (
          self.trackSubfeatureLabels ??
          getConf(self, ['renderer', 'subfeatureLabels'])
        )
      },
      /**
       * #getter
       */
      get displayDirectionalChevrons() {
        return (
          self.trackDisplayDirectionalChevrons ??
          getConf(self, ['renderer', 'displayDirectionalChevrons'])
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        return {
          ...config,
          // Use track overrides if set, otherwise use what's already in configBlob
          // This avoids redundant getConf calls for each property
          showLabels: self.trackShowLabels ?? config.showLabels,
          showDescriptions:
            self.trackShowDescriptions ?? config.showDescriptions,
          subfeatureLabels:
            self.trackSubfeatureLabels ?? config.subfeatureLabels,
          displayMode: self.trackDisplayMode ?? config.displayMode,
          maxHeight: self.trackMaxHeight ?? config.maxHeight,
          geneGlyphMode: self.trackGeneGlyphMode ?? config.geneGlyphMode,
          displayDirectionalChevrons:
            self.trackDisplayDirectionalChevrons ??
            config.displayDirectionalChevrons,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setGeneGlyphMode(val: string) {
        self.trackGeneGlyphMode = val
      },
      /**
       * #action
       */
      setSubfeatureLabels(val: string) {
        self.trackSubfeatureLabels = val
      },
      /**
       * #action
       */
      toggleDisplayDirectionalChevrons() {
        self.trackDisplayDirectionalChevrons = !self.displayDirectionalChevrons
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems(): MenuItem[] {
          const items = superTrackMenuItems()
          const showMenu = findSubMenu(items, 'Show...')
          if (showMenu) {
            showMenu.subMenu = [
              ...showMenu.subMenu,
              {
                label: 'Show chevrons',
                type: 'checkbox',
                checked: self.displayDirectionalChevrons,
                onClick: () => {
                  self.toggleDisplayDirectionalChevrons()
                },
              },
              {
                label: 'Subfeature labels',
                subMenu: ['none', 'below', 'overlay'].map(val => ({
                  label: val,
                  type: 'radio' as const,
                  checked: self.subfeatureLabels === val,
                  onClick: () => {
                    self.setSubfeatureLabels(val)
                  },
                })),
              },
              {
                label: 'Gene glyph',
                subMenu: [
                  {
                    value: 'all',
                    label: 'All transcripts',
                  },
                  {
                    value: 'longest',
                    label: 'Longest transcript',
                  },
                  {
                    value: 'longestCoding',
                    label: 'Longest coding transcript',
                  },
                ].map(({ value, label }) => ({
                  label,
                  type: 'radio' as const,
                  checked: self.geneGlyphMode === value,
                  onClick: () => {
                    self.setGeneGlyphMode(value)
                  },
                })),
              },
            ]
          }
          const filtersMenu = findSubMenu(items, 'Filters')
          if (filtersMenu) {
            filtersMenu.subMenu = [
              {
                label: 'Show only genes',
                type: 'checkbox',
                checked: self.activeFilters.includes(
                  "jexl:get(feature,'type')=='gene'",
                ),
                onClick: () => {
                  const geneFilter = "jexl:get(feature,'type')=='gene'"
                  const currentFilters = self.activeFilters
                  if (currentFilters.includes(geneFilter)) {
                    self.setJexlFilters(
                      currentFilters.filter((f: string) => f !== geneFilter),
                    )
                  } else {
                    self.setJexlFilters([...currentFilters, geneFilter])
                  }
                },
              },
              ...filtersMenu.subMenu,
            ]
          }
          return items
        },
      }
    })
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        trackGeneGlyphMode,
        trackSubfeatureLabels,
        trackDisplayDirectionalChevrons,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(trackGeneGlyphMode !== undefined ? { trackGeneGlyphMode } : {}),
        ...(trackSubfeatureLabels !== undefined
          ? { trackSubfeatureLabels }
          : {}),
        ...(trackDisplayDirectionalChevrons !== undefined
          ? { trackDisplayDirectionalChevrons }
          : {}),
      } as typeof snap
    })
}

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
