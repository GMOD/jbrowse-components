import Plugin from '@jbrowse/core/Plugin'
import { Highlighter } from '@jbrowse/core/ui/Icons'
import { getSession, isAbstractMenuManager } from '@jbrowse/core/util'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarksIcon from '@mui/icons-material/Bookmarks'
import LabelIcon from '@mui/icons-material/Label'

import GridBookmarkWidgetF from './GridBookmarkWidget/index.ts'
import {
  activateBookmarkWidget,
  ensureBookmarkWidget,
  toggleHighlightChipsMenuItem,
  toggleHighlightsMenuItem,
} from './bookmarkViewUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { DotplotViewStateModel } from '@jbrowse/plugin-dotplot-view'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'

export default class GridBookmarkPlugin extends Plugin {
  name = 'GridBookmarkPlugin'

  install(pluginManager: PluginManager) {
    GridBookmarkWidgetF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const lgv = stateModel as LinearGenomeViewStateModel
          const newStateModel = lgv
            .actions(self => ({
              /**
               * #action
               */
              activateBookmarkWidget() {
                return activateBookmarkWidget(self)
              },
            }))
            .actions(self => ({
              /**
               * #action
               */
              navigateNewestBookmark() {
                const session = getSession(self)
                const bookmarkWidget = self.activateBookmarkWidget()
                if (bookmarkWidget.bookmarks.length) {
                  self.navTo(bookmarkWidget.bookmarks.at(-1)!)
                } else {
                  session.notify(
                    'There are no recent bookmarks to navigate to.',
                    'info',
                  )
                }
              },

              /**
               * #action
               */
              bookmarkCurrentRegion() {
                const blocks = self.dynamicBlocks.contentBlocks
                const bookmarkWidget = self.activateBookmarkWidget()
                if (!blocks.length) {
                  throw new Error('no region selected')
                } else {
                  const block = blocks[0]!
                  bookmarkWidget.addBookmark({
                    ...block,
                    start: Math.floor(block.start),
                    end: Math.ceil(block.end),
                  })
                }
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
                      label: 'Bookmarks/highlights',
                      icon: BookmarksIcon,
                      subMenu: [
                        {
                          label: 'Open bookmark widget',
                          icon: BookmarksIcon,
                          onClick: () => self.activateBookmarkWidget(),
                        },
                        {
                          label: 'Bookmark current region',
                          icon: BookmarkIcon,
                          onClick: () => {
                            self.bookmarkCurrentRegion()
                          },
                        },
                        toggleHighlightsMenuItem(self),
                        toggleHighlightChipsMenuItem(self),
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
                      label: 'Open bookmark widget',
                      icon: BookmarksIcon,
                      onClick: () => self.activateBookmarkWidget(),
                    },
                    {
                      label: 'Convert highlight to bookmark',
                      icon: BookmarkIcon,
                      onClick: () => {
                        if (highlight.assemblyName) {
                          self.activateBookmarkWidget().addBookmark({
                            ...highlight,
                            assemblyName: highlight.assemblyName,
                          })
                          self.removeHighlight(highlight)
                        }
                      },
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
                        const selectedRegions = self.getSelectedRegions(
                          leftOffset,
                          rightOffset,
                        )
                        if (selectedRegions.length) {
                          self.addToHighlights(selectedRegions[0]!)
                          self.revealHighlightChips()
                        }
                      },
                    },
                    {
                      label: 'Bookmark region',
                      icon: BookmarkIcon,
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        const selectedRegions = self.getSelectedRegions(
                          leftOffset,
                          rightOffset,
                        )
                        const bookmarkWidget = self.activateBookmarkWidget()
                        if (!selectedRegions.length) {
                          throw new Error('no regions selected')
                        } else {
                          bookmarkWidget.addBookmark(selectedRegions[0]!)
                        }
                      },
                    },
                  ]
                },
              }
            })
            .actions(self => {
              const keydownListener = (e: KeyboardEvent) => {
                const activationSequence =
                  (e.ctrlKey || e.metaKey) && e.shiftKey
                // this listener is registered on document once per open LGV, so
                // without a focus guard a single keypress fires the action once
                // per view (duplicate toasts, every view navigating). only the
                // focused view responds.
                const focused = self.id === getSession(self).focusedViewId
                if (activationSequence && focused) {
                  // ctrl+shift+d or cmd+shift+d
                  if (e.code === 'KeyD') {
                    e.preventDefault()
                    self.activateBookmarkWidget()
                    self.bookmarkCurrentRegion()
                    getSession(self).notify('Bookmark created.', 'success')
                  }
                  // ctrl+shift+m or cmd+shift+m
                  if (e.code === 'KeyM') {
                    e.preventDefault()
                    self.navigateNewestBookmark()
                  }
                }
              }
              return {
                afterCreate() {
                  document.addEventListener('keydown', keydownListener)
                },
                afterAttach() {
                  ensureBookmarkWidget(self)
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
              if (
                s.bookmarkLabelsVisible === false &&
                !('labelsVisible' in s)
              ) {
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
            })

          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        if (pluggableElement.name === 'DotplotView') {
          const { stateModel } = pluggableElement as ViewType
          const dotplot = stateModel as DotplotViewStateModel
          const newStateModel = dotplot
            .actions(self => ({
              /**
               * #action
               */
              activateBookmarkWidget() {
                return activateBookmarkWidget(self)
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
                      label: 'Bookmarks/highlights',
                      icon: BookmarksIcon,
                      subMenu: [
                        {
                          label: 'Open bookmark widget',
                          icon: BookmarksIcon,
                          onClick: () => self.activateBookmarkWidget(),
                        },
                        toggleHighlightsMenuItem(self),
                        toggleHighlightChipsMenuItem(self),
                      ],
                    },
                  ]
                },
              }
            })
            .actions(self => ({
              afterAttach() {
                ensureBookmarkWidget(self)
              },
            }))

          ;(pluggableElement as ViewType).stateModel = newStateModel
        }
        return pluggableElement
      },
    )
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToMenu('Tools', {
        label: 'Bookmarks/highlights',
        icon: BookmarksIcon,
        onClick: (session: SessionWithWidgets) => {
          let bookmarkWidget = session.widgets.get('GridBookmark')
          bookmarkWidget ??= session.addWidget(
            'GridBookmarkWidget',
            'GridBookmark',
          )
          session.showWidget(bookmarkWidget)
        },
      })
    }
  }
}
