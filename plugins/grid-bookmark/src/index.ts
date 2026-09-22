import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { isAbstractMenuManager } from '@jbrowse/core/util'
import HighlightIcon from '@mui/icons-material/Highlight'
import ListIcon from '@mui/icons-material/List'

import GridBookmarkWidgetF from './GridBookmarkWidget/index.ts'
import { activateHighlightWidget } from './bookmarkViewUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'

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
            return activateHighlightWidget(self)
          },
        }))
        .views(self => {
          const superHighlightsSubMenuItems = self.highlightsSubMenuItems
          const superHighlightMenuItems = self.highlightMenuItems
          const openList = {
            label: 'Open highlight list',
            icon: ListIcon,
            onClick: () => self.activateHighlightWidget(),
          }
          return {
            highlightsSubMenuItems() {
              return [...superHighlightsSubMenuItems(), openList]
            },
            highlightMenuItems(
              highlight: Parameters<typeof superHighlightMenuItems>[0],
            ) {
              return [...superHighlightMenuItems(highlight), openList]
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
        onClick: (session: SessionWithWidgets) => {
          session.openWidget('GridBookmarkWidget', 'GridBookmark')
        },
      })
    }
  }
}
