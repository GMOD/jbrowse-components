import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
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
                  activateBookmarkWidget() {
                    const session = getSession(self)
                    if (isSessionModelWithWidgets(session)) {
                      let bookmarkWidget = session.widgets.get('GridBookmark')
                      if (!bookmarkWidget) {
                        bookmarkWidget = session.addWidget(
                          'GridBookmarkWidget',
                          'GridBookmark',
                          { view: self },
                        )
                      }

                      session.showWidget(bookmarkWidget)
                      return bookmarkWidget
                    }

                    throw new Error('Could not open bookmark widget')
                  },

                  bookmarkCurrentRegion() {
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
                  },
                },
                views: {
                  menuItems() {
                    const newMenuItems = [
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

                    return newMenuItems
                  },

                  rubberBandMenuItems() {
                    const newRubberBandMenuItems = [
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

                    return newRubberBandMenuItems
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

  configure(_pluginManager: PluginManager) {}
}
