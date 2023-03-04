import {
  ConfigurationReference,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'

import { linearPileupDisplayStateModelFactory } from '@jbrowse/plugin-alignments'
import { types } from 'mobx-state-tree'
import navTo from './navToSyntenicPosition'

/**
 * #stateModel LGVSyntenyDisplay
 * extends `LinearPileupDisplay`, displays location of "synteny" feature in a
 * plain LGV, allowing linking out to external synteny views
 */
export default function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LGVSyntenyDisplay',
      linearPileupDisplayStateModelFactory(schema),
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
                    onClick: () => navTo(feature, self),
                  },
                ]
              : []),
          ]
        },
      }
    })
    .actions(self => ({
      afterCreate() {
        // use color by strand to help indicate inversions better
        self.setColorScheme({ type: 'strand' })
      },
    }))
}
