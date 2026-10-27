import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import {
  getSession,
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import HighlightIcon from '@mui/icons-material/Highlight'
import ListIcon from '@mui/icons-material/List'

import GridBookmarkWidgetF from './GridBookmarkWidget/index.ts'

import type { GridBookmarkModel } from './GridBookmarkWidget/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
// extendViewType's registry entry for DotplotView, which the esm build needs
// eslint-disable-next-line unicorn/require-module-specifiers
import type {} from '@jbrowse/plugin-dotplot-view'

function openHighlightList(node: IAnyStateTreeNode) {
  const session = getSession(node)
  if (isSessionModelWithWidgets(session)) {
    return session.openWidget(
      'GridBookmarkWidget',
      'GridBookmark',
    ) as GridBookmarkModel
  }
  throw new Error('Could not open the highlight list')
}

const openListItem = (node: IAnyStateTreeNode) => ({
  label: 'Open highlight list',
  icon: ListIcon,
  onClick: () => {
    openHighlightList(node)
  },
})

export default class GridBookmarkPlugin extends Plugin {
  name = 'GridBookmarkPlugin'

  install(pluginManager: PluginManager) {
    GridBookmarkWidgetF(pluginManager)

    // No member tags here: the generator buckets a member by its own file, so a
    // tag in an extendViewType block renders nowhere. Teaching it to follow the
    // composition was declined at one consumer, ADR-040's bar.
    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      stateModel
        .actions(self => ({
          activateHighlightWidget() {
            return openHighlightList(self)
          },
        }))
        .views(self => {
          const superHighlightsSubMenuItems = self.highlightsSubMenuItems
          return {
            highlightsSubMenuItems() {
              return [...superHighlightsSubMenuItems(), openListItem(self)]
            },
          }
        }),
    )
    extendViewType(
      pluginManager,
      ['LinearGenomeView', 'DotplotView'],
      stateModel =>
        stateModel.views(self => {
          const superHighlightMenuItems = self.highlightMenuItems
          return {
            highlightMenuItems(highlight: HighlightType) {
              return [...superHighlightMenuItems(highlight), openListItem(self)]
            },
          }
        }),
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Highlights',
        icon: HighlightIcon,
        onClick: openHighlightList,
      })
    }
  }
}
