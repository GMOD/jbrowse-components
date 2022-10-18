import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

// icons
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { Curves, StraightLines } from './components/Icons'

// locals
import baseModel from '../LinearComparativeView/model'

/**
 * !stateModel LinearSyntenyView
 * extends the LinearComparativeView base model
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      baseModel(pluginManager),
      types
        .model('LinearSyntenyView', {
          /**
           * !property
           */
          type: types.literal('LinearSyntenyView'),
          /**
           * !property
           */
          drawCurves: false,
        })
        .actions(self => ({
          /**
           * !action
           */
          toggleCurves() {
            self.drawCurves = !self.drawCurves
          },
        })),
    )
    .views(self => {
      const superMenuItems = self.menuItems
      return {
        /**
         * !method
         */
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
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
