import { getRoot } from 'mobx-state-tree'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
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

import GridBookmarkWidgetF from './GridBookmarkWidget'

export default class extends Plugin {
  name = 'GridBookmarkPlugin'

  install(pluginManager: PluginManager) {
    GridBookmarkWidgetF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-extendPluggableElement',
      (pluggableElement: PluggableElementType) => {
        if (pluggableElement.name === 'LinearGenomeView') {
          const { stateModel } = pluggableElement as ViewType
          const newStateModel = stateModel.extend(
            (self: LinearGenomeViewModel) => {
              const superMenuItems = self.menuItems
              const superRubberBandMenuItems = self.rubberBandMenuItems
              return {
                actions: {
                  afterCreate() {
                    document.addEventListener('keydown', e => {
                      // ctrl+shift+d or cmd+shift+d
                      if (
                        (e.ctrlKey || e.metaKey) &&
                        e.shiftKey &&
                        e.code === 'KeyD'
                      ) {
                        e.preventDefault()
                        // @ts-ignore
                        self.bookmarkCurrentRegion()
                        getSession(self).notify('Bookmark created.', 'success')
                      }
                      // ctrl+shift+m or cmd+shift+m
                      if (
                        (e.ctrlKey || e.metaKey) &&
                        e.shiftKey &&
                        e.code === 'KeyM'
                      ) {
                        e.preventDefault()
                        this.navigateNewestBookmark()
                      }
                    })
                  },
                  navigateNewestBookmark() {
                    const session = getSession(self)
                    if (isSessionModelWithWidgets(session)) {
                      const { widgets } = session
                      let bookmarkWidget = widgets.get('GridBookmark')
                      if (!bookmarkWidget) {
                        // @ts-ignore
                        self.activateBookmarkWidget()
                        bookmarkWidget = widgets.get('GridBookmark')
                      }
                      // @ts-expect-error
                      const regions = bookmarkWidget.bookmarkedRegions
                      if (regions.length !== 0) {
                        self.navTo(regions[regions.length - 1])
                        session.notify(
                          'Navigated to the most recently created bookmark.',
                          'success',
                        )
                      } else {
                        session.notify(
                          'There are no recent bookmarks to navigate to.',
                          'info',
                        )
                      }
                    }
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
                      return bookmarkWidget
                    }

                    throw new Error('Could not open bookmark widget')
                  },

                  bookmarkCurrentRegion() {
                    // @ts-ignore
                    if (self.id === getSession(self).focusedViewId) {
                      const selectedRegions = self.getSelectedRegions(
                        self.leftOffset,
                        self.rightOffset,
                      )
                      const firstRegion = selectedRegions[0]
                      const session = getSession(self)
                      if (isSessionModelWithWidgets(session)) {
                        const { widgets } = session
                        let bookmarkWidget = widgets.get('GridBookmark')
                        if (!bookmarkWidget) {
                          this.activateBookmarkWidget()
                          bookmarkWidget = widgets.get('GridBookmark')
                        }
                        // @ts-expect-error
                        bookmarkWidget.addBookmark(firstRegion)
                      }
                    }
                  },
                },
                views: {
                  menuItems() {
                    return [
                      ...superMenuItems(),
                      { type: 'divider' },
                      {
                        label: 'Open bookmark widget',
                        icon: BookmarksIcon,
                        // @ts-expect-error
                        onClick: self.activateBookmarkWidget,
                      },
                      {
                        label: 'Bookmark current region',
                        icon: BookmarkIcon,
                        // @ts-expect-error
                        onClick: self.bookmarkCurrentRegion,
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
                          const firstRegion = selectedRegions[0]
                          const session = getSession(self)
                          if (isSessionModelWithWidgets(session)) {
                            const { widgets } = session
                            let bookmarkWidget = widgets.get('GridBookmark')
                            if (!bookmarkWidget) {
                              // @ts-expect-error
                              self.activateBookmarkWidget()
                              bookmarkWidget = widgets.get('GridBookmark')
                            }
                            // @ts-expect-error
                            bookmarkWidget.addBookmark(firstRegion)
                          }
                        },
                      },
                    ]
                  },
                },
              }
            },
          )

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
