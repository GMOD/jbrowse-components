import { lazy } from 'react'

import BookmarkIcon from '@material-ui/icons/Bookmark'
import BookmarksIcon from '@material-ui/icons/Bookmarks'

import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { getSession } from '@jbrowse/core/util'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { isSessionModelWithWidgets } from '@jbrowse/core/util'

import {
  stateModelFactory as GridBookmarkStateModelFactory,
  configSchema as GridBookmarkConfigSchema,
} from './GridBookmarkWidget'
import { PluggableElementType } from '@jbrowse/core/pluggableElementTypes'

export default class extends Plugin {
  name = 'GridBookmarkPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'GridBookmarkWidget',
        heading: 'Bookmarked regions',
        configSchema: GridBookmarkConfigSchema,
        stateModel: GridBookmarkStateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./GridBookmarkWidget/components/GridBookmarkWidget'),
        ),
      })
    })

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
                    // @ts-ignore
                    const { widgets } = getSession(self)
                    let bookmarkWidget = widgets.get('GridBookmark')
                    if (!bookmarkWidget) {
                      this.activateBookmarkWidget()
                      bookmarkWidget = widgets.get('GridBookmark')
                    }
                    bookmarkWidget.addBookmark(firstRegion)
                  },
                },
                views: {
                  menuItems() {
                    const menuItems = superMenuItems()
                    menuItems.push(
                      { type: 'divider' },
                      {
                        label: 'Open bookmark widget',
                        icon: BookmarksIcon,
                        // @ts-ignore
                        onClick: self.activateBookmarkWidget,
                      },
                      {
                        label: 'Bookmark current region',
                        icon: BookmarkIcon,
                        // @ts-ignore
                        onClick: self.bookmarkCurrentRegion,
                      },
                    )
                    return menuItems
                  },

                  rubberBandMenuItems() {
                    const rubberBandMenuItems = superRubberBandMenuItems()
                    rubberBandMenuItems.push({
                      label: 'Bookmark region',
                      icon: BookmarkIcon,
                      onClick: () => {
                        const { leftOffset, rightOffset } = self
                        const selectedRegions = self.getSelectedRegions(
                          leftOffset,
                          rightOffset,
                        )
                        const firstRegion = selectedRegions[0]
                        // @ts-ignore
                        const { widgets } = getSession(self)
                        let bookmarkWidget = widgets.get('GridBookmark')
                        if (!bookmarkWidget) {
                          // @ts-ignore
                          self.activateBookmarkWidget()
                          bookmarkWidget = widgets.get('GridBookmark')
                        }
                        bookmarkWidget.addBookmark(firstRegion)
                      },
                    })
                    return rubberBandMenuItems
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  configure(pluginManager: PluginManager) {}
}
