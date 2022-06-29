import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

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
        searchScope(assemblyName: string) {
          return {
            assemblyName,
            includeAggregateIndexes: true,
            tracks: self.tracks,
          }
        },
        rankSearchResults(results: BaseResult[]) {
          // order of rank
          const openTrackIds = self.tracks.map(
            track => track.configuration.trackId,
          )
          results.forEach(result => {
            if (openTrackIds !== []) {
              if (openTrackIds.includes(result.trackId)) {
                result.updateScore(result.getScore() + 1)
              }
            }
          })
          return results
        },
      }
    })
}
export type MultilevelLinearViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultilevelLinearViewModel = Instance<MultilevelLinearViewStateModel>
