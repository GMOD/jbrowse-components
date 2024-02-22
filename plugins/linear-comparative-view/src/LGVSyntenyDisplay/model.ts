import { lazy } from 'react'
import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { SharedLinearPileupDisplayMixin } from '@jbrowse/plugin-alignments'
import { types } from 'mobx-state-tree'

const LaunchSyntenyViewDialog = lazy(
  () => import('./components/LaunchSyntenyViewDialog'),
)

/**
 * #stateModel LGVSyntenyDisplay
 * displays location of "synteny" feature in a plain LGV, allowing linking out
 * to external synteny views
 *
 * extends
 * - [SharedLinearPileupDisplayMixin](../sharedlinearpileupdisplaymixin)
 */
function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LGVSyntenyDisplay',
      SharedLinearPileupDisplayMixin(schema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LGVSyntenyDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(schema),
      }),
    )
    .views(self => {
      const superContextMenuItems = self.contextMenuItems
      return {
        /**
         * #method
         */
        contextMenuItems() {
          const feature = self.contextMenuFeature
          return [
            ...superContextMenuItems(),
            ...(feature
              ? [
                  {
                    label: 'Open synteny view for this position',
                    onClick: () => {
                      getSession(self).queueDialog(handleClose => [
                        LaunchSyntenyViewDialog,
                        {
                          model: self,
                          handleClose,
                          feature,
                        },
                      ])
                    },
                  },
                ]
              : []),
          ]
        },
      }
    })
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        colorSchemeSubMenuItems: superColorSchemeSubMenuItems,
      } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Color scheme',
              subMenu: [...superColorSchemeSubMenuItems()],
            },
          ]
        },
      }
    })
    .actions(self => ({
      afterCreate() {
        // use color by stand to help indicate inversions better on first load,
        // otherwise use selected orientation
        if (self.colorBy) {
          self.setColorScheme({ ...self.colorBy })
        } else {
          self.setColorScheme({ type: 'strand' })
        }
      },
    }))
}

export default stateModelFactory
