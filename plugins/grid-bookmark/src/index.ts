import Plugin from '@jbrowse/core/Plugin'
import {
  getSession,
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

// icons
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarksIcon from '@mui/icons-material/Bookmarks'
import HighlightIcon from '@mui/icons-material/Highlight'
import LabelIcon from '@mui/icons-material/Label'

import GridBookmarkWidgetF from './GridBookmarkWidget'
import type { GridBookmarkModel } from './GridBookmarkWidget/model'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import type { SessionWithWidgets } from '@jbrowse/core/util'
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
            .props({
              /**
               * #property
               * show the bookmark highlights on this track
               */
              showBookmarkHighlights: true,
              /**
               * #property
               * show the bookmark labels on this track
               */
              showBookmarkLabels: true,
            })
            .actions(self => ({
              /**
               * #action
               */
              toggleShowBookmarkHighlights(toggle?: boolean) {
                self.showBookmarkHighlights =
                  toggle !== undefined ? toggle : !self.showBookmarkHighlights
              },
              /**
               * #action
               */
              toggleShowBookmarkLabels(toggle?: boolean) {
                self.showBookmarkLabels =
                  toggle !== undefined ? toggle : !self.showBookmarkLabels
              },
              activateBookmarkWidget() {
                const session = getSession(self)
                if (isSessionModelWithWidgets(session)) {
                  let bookmarkWidget = session.widgets.get('GridBookmark')
                  if (!bookmarkWidget) {
                    bookmarkWidget = session.addWidget(
                      'GridBookmarkWidget',
                      'GridBookmark',
                    )
                  }

                  session.showWidget(bookmarkWidget)
                  return session.widgets.get(
                    'GridBookmark',
                  ) as GridBookmarkModel
                }

                throw new Error('Could not open bookmark widget')
              },
            }))
            .actions(self => ({
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

              bookmarkCurrentRegion() {
                if (self.id === getSession(self).focusedViewId) {
                  const selectedRegions = self.getSelectedRegions(
                    undefined,
                    undefined,
                  )
                  const bookmarkWidget = self.activateBookmarkWidget()
                  if (!selectedRegions.length) {
                    throw new Error('no region selected')
                  } else {
                    bookmarkWidget.addBookmark(selectedRegions[0]!)
                  }
                }
              },
            }))
            .views(self => {
              const superMenuItems = self.menuItems
              const superRubberBandMenuItems = self.rubberBandMenuItems
              return {
                menuItems() {
                  return [
                    ...superMenuItems(),
                    { type: 'divider' },
                    {
                      label: 'Bookmarks',
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
                        {
                          label: 'Toggle bookmark highlights',
                          icon: HighlightIcon,
                          type: 'checkbox',
                          checked: self.showBookmarkHighlights,
                          onClick: () => {
                            self.toggleShowBookmarkHighlights()
                          },
                        },
                        {
                          label: 'Toggle bookmark labels',
                          icon: LabelIcon,
                          type: 'checkbox',
                          checked: self.showBookmarkLabels,
                          onClick: () => {
                            self.toggleShowBookmarkLabels()
                          },
                        },
                      ],
                    },
                  ]
                },

                rubberBandMenuItems() {
                  return [
                    ...superRubberBandMenuItems(),
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
            .actions(self => ({
              afterCreate() {
                document.addEventListener('keydown', e => {
                  const activationSequence =
                    (e.ctrlKey || e.metaKey) && e.shiftKey
                  // ctrl+shift+d or cmd+shift+d
                  if (activationSequence && e.code === 'KeyD') {
                    e.preventDefault()
                    self.activateBookmarkWidget()
                    self.bookmarkCurrentRegion()
                    getSession(self).notify('Bookmark created.', 'success')
                  }
                  // ctrl+shift+m or cmd+shift+m
                  if (activationSequence && e.code === 'KeyM') {
                    e.preventDefault()
                    self.navigateNewestBookmark()
                  }
                })
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
        label: 'Bookmarks',
        icon: BookmarksIcon,
        onClick: (session: SessionWithWidgets) => {
          let bookmarkWidget = session.widgets.get('GridBookmark')
          if (!bookmarkWidget) {
            bookmarkWidget = session.addWidget(
              'GridBookmarkWidget',
              'GridBookmark',
            )
          }
          session.showWidget(bookmarkWidget)
        },
      })
    }
  }
}
