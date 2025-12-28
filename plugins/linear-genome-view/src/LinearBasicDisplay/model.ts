import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { modelFactory as LinearFeatureDisplayModelFactory } from '../LinearFeatureDisplay'

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
          showLabels: self.showLabels,
          showDescriptions: self.showDescriptions,
          subfeatureLabels: self.subfeatureLabels,
          displayMode: self.displayMode,
          maxHeight: self.maxHeight,
          geneGlyphMode: self.geneGlyphMode,
          displayDirectionalChevrons: self.displayDirectionalChevrons,
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
                shortcut: 'c',
                type: 'checkbox',
                checked: self.displayDirectionalChevrons,
                onClick: () => {
                  self.toggleDisplayDirectionalChevrons()
                },
              },
              {
                label: 'Subfeature labels',
                shortcut: 's',
                subMenu: ['none', 'below', 'overlay'].map((val, idx) => ({
                  label: val,
                  shortcut: `${idx + 1}`,
                  type: 'radio' as const,
                  checked: self.subfeatureLabels === val,
                  onClick: () => {
                    self.setSubfeatureLabels(val)
                  },
                })),
              },
              {
                label: 'Gene glyph',
                shortcut: 'g',
                subMenu: [
                  {
                    value: 'all',
                    label: 'All transcripts',
                    shortcut: '1',
                  },
                  {
                    value: 'longest',
                    label: 'Longest transcript',
                    shortcut: '2',
                  },
                  {
                    value: 'longestCoding',
                    label: 'Longest coding transcript',
                    shortcut: '3',
                  },
                ].map(({ value, label, shortcut }) => ({
                  label,
                  shortcut,
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
                shortcut: 'g',
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
