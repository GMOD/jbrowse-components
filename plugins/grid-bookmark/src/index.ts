import Plugin from '@jbrowse/core/Plugin'
import { extendViewType } from '@jbrowse/core/pluggableElementTypes'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import {
  getNotificationSink,
  getSession,
  isAbstractMenuManager,
} from '@jbrowse/core/util'
import HighlightIcon from '@mui/icons-material/Highlight'
import LabelIcon from '@mui/icons-material/Label'
import ListIcon from '@mui/icons-material/List'

import GridBookmarkWidgetF from './GridBookmarkWidget/index.ts'
import { navToHighlight } from './GridBookmarkWidget/utils.ts'
import {
  activateHighlightWidget,
  toggleHighlightsMenuItem,
} from './bookmarkViewUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { HighlightType } from '@jbrowse/core/util/highlights'

function regionHighlight(r: {
  assemblyName: string
  refName: string
  start: number
  end: number
}): HighlightType {
  return {
    assemblyName: r.assemblyName,
    refName: r.refName,
    start: r.start,
    end: r.end,
  }
}

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
          /**
           * #action
           */
          navigateNewestHighlight() {
            const session = getSession(self)
            const newest = session.highlights.at(-1)
            if (newest) {
              void navToHighlight(newest, self)
            } else {
              session.notify('There are no highlights to navigate to.', 'info')
            }
          },
          /**
           * #action
           */
          highlightCurrentRegion() {
            const [region] = self.visibleWholeBaseRegions
            if (!region) {
              throw new Error('no region selected')
            }
            getSession(self).addHighlight(regionHighlight(region))
          },
        }))
        .views(self => {
          const superMenuItems = self.menuItems
          const superRubberBandMenuItems = self.rubberBandMenuItems
          const superHighlightMenuItems = self.highlightMenuItems
          return {
            /**
             * #method
             */
            menuItems() {
              return [
                ...superMenuItems(),
                {
                  label: 'Highlights',
                  icon: HighlightIcon,
                  subMenu: [
                    {
                      label: 'Open highlight list',
                      icon: ListIcon,
                      onClick: () => self.activateHighlightWidget(),
                    },
                    {
                      label: 'Highlight current region',
                      icon: Highlighter,
                      onClick: () => {
                        self.highlightCurrentRegion()
                      },
                    },
                    toggleHighlightsMenuItem(self),
                    {
                      label: 'Toggle labels',
                      icon: LabelIcon,
                      type: 'checkbox',
                      checked: self.labelsVisible,
                      onClick: () => {
                        self.setLabelsVisible(!self.labelsVisible)
                      },
                    },
                  ],
                },
              ]
            },

            /**
             * #method
             */
            highlightMenuItems(
              highlight: Parameters<typeof superHighlightMenuItems>[0],
            ) {
              return [
                ...superHighlightMenuItems(highlight),
                {
                  label: 'Open highlight list',
                  icon: ListIcon,
                  onClick: () => self.activateHighlightWidget(),
                },
              ]
            },

            /**
             * #method
             */
            rubberBandMenuItems() {
              return [
                ...superRubberBandMenuItems(),
                {
                  label: 'Highlight region',
                  icon: Highlighter,
                  onClick: () => {
                    const { leftOffset, rightOffset } = self
                    const [region] = self.getSelectedRegions(
                      leftOffset,
                      rightOffset,
                    )
                    if (region) {
                      getSession(self).addHighlight(regionHighlight(region))
                    }
                  },
                },
              ]
            },
          }
        })
        .actions(self => {
          const keydownListener = (e: KeyboardEvent) => {
            const activationSequence = (e.ctrlKey || e.metaKey) && e.shiftKey
            // this listener is registered on document once per open LGV, so
            // without a focus guard a single keypress fires the action once
            // per view (duplicate toasts, every view navigating). only the
            // focused view responds.
            const focused = self.id === getSession(self).focusedViewId
            if (activationSequence && focused) {
              // ctrl+shift+d or cmd+shift+d
              if (e.code === 'KeyD') {
                e.preventDefault()
                self.highlightCurrentRegion()
                getNotificationSink(self).notify(
                  'Region highlighted.',
                  'success',
                )
              }
              // ctrl+shift+m or cmd+shift+m
              if (e.code === 'KeyM') {
                e.preventDefault()
                self.navigateNewestHighlight()
              }
            }
          }
          return {
            afterCreate() {
              document.addEventListener('keydown', keydownListener)
            },
            beforeDestroy() {
              document.removeEventListener('keydown', keydownListener)
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

    extendViewType(pluginManager, 'DotplotView', stateModel =>
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
          const superMenuItems = self.menuItems
          return {
            /**
             * #method
             */
            menuItems() {
              return [
                ...superMenuItems(),
                {
                  label: 'Highlights',
                  icon: HighlightIcon,
                  subMenu: [
                    {
                      label: 'Open highlight list',
                      icon: ListIcon,
                      onClick: () => self.activateHighlightWidget(),
                    },
                    toggleHighlightsMenuItem(self),
                  ],
                },
              ]
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
          let widget = session.widgets.get('GridBookmark')
          widget ??= session.addWidget('GridBookmarkWidget', 'GridBookmark')
          session.showWidget(widget)
        },
      })
    }
  }
}
