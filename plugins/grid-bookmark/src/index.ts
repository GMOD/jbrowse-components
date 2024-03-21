import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import {
  SessionWithWidgets,
  getSession,
  isAbstractMenuManager,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  PluggableElementType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'

// icons
import BookmarkIcon from '@mui/icons-material/Bookmark'
import BookmarksIcon from '@mui/icons-material/Bookmarks'
import HighlightIcon from '@mui/icons-material/Highlight'
import LabelIcon from '@mui/icons-material/Label'

import GridBookmarkWidgetF from './GridBookmarkWidget'
import { GridBookmarkModel } from './GridBookmarkWidget/model'

export default class extends Plugin {
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
            }))
            .actions(self => ({
              bookmarkCurrentRegion() {
                if (self.id === getSession(self).focusedViewId) {
                  const selectedRegions = self.getSelectedRegions(
                    undefined,
                    undefined,
                  )
                  const bookmarkWidget = self.activateBookmarkWidget()
                  bookmarkWidget.addBookmark(selectedRegions[0])
                }
              },

              navigateNewestBookmark() {
                const session = getSession(self)
                const bookmarkWidget = self.activateBookmarkWidget()
                const regions = bookmarkWidget.bookmarks
                if (regions?.length) {
                  self.navTo(regions.at(-1)!)
                } else {
                  session.notify(
                    'There are no recent bookmarks to navigate to.',
                    'info',
                  )
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
                      icon: BookmarksIcon,
                      label: 'Bookmarks',
                      subMenu: [
                        {
                          icon: BookmarksIcon,
                          label: 'Open bookmark widget',
                          onClick: () => self.activateBookmarkWidget(),
                        },
                        {
                          icon: BookmarkIcon,
                          label: 'Bookmark current region',
                          onClick: () => self.bookmarkCurrentRegion(),
                        },
                        {
                          checked: self.showBookmarkHighlights,
                          icon: HighlightIcon,
                          label: 'Toggle bookmark highlights',
                          onClick: () => self.toggleShowBookmarkHighlights(),
                          type: 'checkbox',
                        },
                        {
                          checked: self.showBookmarkLabels,
                          icon: LabelIcon,
                          label: 'Toggle bookmark labels',
                          onClick: () => self.toggleShowBookmarkLabels(),
                          type: 'checkbox',
                        },
                      ],
                    },
                  ]
                },

                rubberBandMenuItems() {
                  return [
                    ...superRubberBandMenuItems(),
                    {
                      icon: BookmarkIcon,
                      label: 'Bookmark region',
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        const selectedRegions = self.getSelectedRegions(
                          leftOffset,
                          rightOffset,
                        )
                        const bookmarkWidget = self.activateBookmarkWidget()
                        bookmarkWidget.addBookmark(selectedRegions[0])
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
        icon: BookmarksIcon,
        label: 'Bookmarks',
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
