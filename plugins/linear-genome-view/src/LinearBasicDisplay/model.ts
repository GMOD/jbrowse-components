import { ConfigurationReference } from '@jbrowse/core/configuration'
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
        configuration: ConfigurationReference(configSchema),
      }),
    )
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
            ]
          }
          return items
        },
      }
    })
}

export type FeatureTrackStateModel = ReturnType<typeof stateModelFactory>
export type FeatureTrackModel = Instance<FeatureTrackStateModel>

export default stateModelFactory
