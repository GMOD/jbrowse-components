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

    extendViewType(pluginManager, 'LinearGenomeView', stateModel =>
      stateModel
        .actions(self => ({
          /**
           * #action
           */
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
            /**
             * #method
             */
            highlightsSubMenuItems() {
              return [...superHighlightsSubMenuItems(), openList]
            },
            /**
             * #method
             */
            highlightMenuItems(
              highlight: Parameters<typeof superHighlightMenuItems>[0],
            ) {
              return [...superHighlightMenuItems(highlight), openList]
            },
          }
        })
        .preProcessSnapshot(snap => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!snap || typeof snap !== 'object') {
            return snap
          }
          // migrate old per-plugin bookmarkLabelsVisible to base LGV
          // labelsVisible so users who had set it to false keep that state
          const s = snap as Record<string, unknown>
          if (s.bookmarkLabelsVisible === false && !('labelsVisible' in s)) {
            const { bookmarkLabelsVisible: _ignored, ...rest } = s
            return { ...rest, labelsVisible: false }
          }
          return snap
        })
        .postProcessSnapshot(snap => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!snap) {
            return snap
          }
          const {
            // strip dead per-view flags from any pre-existing snapshots:
            // highlight visibility is now a single session-wide flag, and
            // labels are controlled by base LGV labelsVisible
            bookmarkHighlightsVisible: _bhv,
            bookmarkLabelsVisible: _blv,
            highlightsVisible: _hv,
            // strip the LGV default here too — postProcessSnapshot chain
            // ordering isn't guaranteed, so we guard in both places
            labelsVisible,
            ...rest
          } = snap as unknown as Record<string, unknown>
          return {
            ...rest,
            ...(!labelsVisible ? { labelsVisible } : {}),
          } as typeof snap
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
