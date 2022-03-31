import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import CropFreeIcon from '@material-ui/icons/CropFree'
import LinkIcon from '@material-ui/icons/Link'
import LinkOffIcon from '@material-ui/icons/LinkOff'
import { Curves, StraightLines } from './components/Icons'

import baseModel from '../MultilevelLinearComparativeView/model'

export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      baseModel(pluginManager),
      types
        .model('MultilevelLinearView', {
          type: types.literal('MultilevelLinearView'),
          drawCurves: false,
        })
        .actions(self => ({
          toggleCurves() {
            self.drawCurves = !self.drawCurves
          },
        })),
    )
    .views(self => {
      const superMenuItems = self.menuItems
      return {
        menuItems() {
          return [
            ...superMenuItems(),

            {
              label: 'Square view',
              onClick: self.squareView,
              description:
                'Makes both views use the same zoom level, adjusting to the average of each',
              icon: CropFreeIcon,
            },
            {
              label: self.linkViews ? 'Unlink views' : 'Link views',
              onClick: self.toggleLinkViews,
              icon: self.linkViews ? LinkOffIcon : LinkIcon,
            },
            {
              label: self.drawCurves
                ? 'Use straight lines'
                : 'Use curved lines',
              onClick: self.toggleCurves,
              icon: self.drawCurves ? StraightLines : Curves,
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
