import { types, Instance } from 'mobx-state-tree'
import { transaction } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'

// icons
import CropFreeIcon from '@mui/icons-material/CropFree'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { Curves } from './components/Icons'

// locals
import baseModel from '../LinearComparativeView/model'
import VisibilityIcon from '@mui/icons-material/Visibility'

/**
 * #stateModel LinearSyntenyView
 * extends the `LinearComparativeView` base model
 */
export default function stateModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      baseModel(pluginManager),
      types.model('LinearSyntenyView', {
        /**
         * #property
         */
        type: types.literal('LinearSyntenyView'),
        /**
         * #property/
         */
        drawCIGAR: true,
        /**
         * #property
         */
        drawCurves: false,
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      toggleCurves() {
        self.drawCurves = !self.drawCurves
      },
      /**
       * #action
       */
      toggleCIGAR() {
        self.drawCIGAR = !self.drawCIGAR
      },
      /**
       * #action
       */
      showAllRegions() {
        transaction(() => {
          self.views.forEach(view => view.showAllRegionsInAssembly())
        })
      },
    }))
    .views(self => {
      const superMenuItems = self.headerMenuItems
      return {
        /**
         * #method
         * includes a subset of view menu options because the full list is a
         * little overwhelming
         */
        headerMenuItems() {
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
              label: 'Show all regions',
              onClick: self.showAllRegions,
              description: 'Show entire genome assemblies',
              icon: VisibilityIcon,
            },
            {
              label: 'Draw CIGAR',
              onClick: self.toggleCIGAR,
              checked: self.drawCIGAR,
              type: 'checkbox',
              description: 'Draws per-base CIGAR level alignments',
              icon: VisibilityIcon,
            },
            {
              label: self.linkViews ? 'Unlink views' : 'Link views',
              onClick: self.toggleLinkViews,
              icon: self.linkViews ? LinkOffIcon : LinkIcon,
            },
            {
              label: 'Use curved lines',
              type: 'checkbox',
              checked: self.drawCurves,
              onClick: self.toggleCurves,
              icon: Curves,
            },
          ]
        },
      }
    })
}
export type LinearSyntenyViewStateModel = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
