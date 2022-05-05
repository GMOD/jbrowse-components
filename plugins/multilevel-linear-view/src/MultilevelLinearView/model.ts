import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import FormatAlignCenterIcon from '@material-ui/icons/FormatAlignCenter'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'

import baseModel from '../MultilevelLinearComparativeView/model'

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      baseModel(pluginManager),
      types.model('MultilevelLinearView', {
        type: types.literal('MultilevelLinearView'),
      }),
    )
    .views(self => {
      const superMenuItems = self.menuItems
      return {
        menuItems() {
          return [
            ...superMenuItems(),

            {
              label: 'Align views',
              onClick: self.alignViews,
              description: 'Align views (realign sub views to the anchor view)',
              icon: FormatAlignCenterIcon,
            },
            {
              label: self.linkViews ? 'Unlink views' : 'Link views',
              onClick: self.toggleLinkViews,
              icon: self.linkViews ? LinkOffIcon : LinkIcon,
            },
          ]
        },
      }
    })
}
export type MultilevelLinearViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultilevelLinearViewModel = Instance<MultilevelLinearViewStateModel>
