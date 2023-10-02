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
            }))
            .actions(self => ({
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
                      label: 'Open bookmark widget',
                      icon: BookmarksIcon,
                      onClick: () => self.activateBookmarkWidget(),
                    },
                    {
                      label: 'Bookmark current region',
                      icon: BookmarkIcon,
                      onClick: () => self.bookmarkCurrentRegion(),
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
