import {
  addDisposer,
  cast,
  getPath,
  onAction,
  types,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'
import FolderOpenIcon from '@material-ui/icons/FolderOpen'
import MenuIcon from '@material-ui/icons/Menu'
/* eslint-disable @typescript-eslint/no-explicit-any */
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { MenuItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import PluginManager from '@jbrowse/core/PluginManager'
import { ReturnToImportFormDialog } from '@jbrowse/core/ui'

import { ElementId } from '@jbrowse/core/util/types/mst'

export default function stateModelFactory(pluginManager: PluginManager) {
  const defaultHeight = 400
  return types
    .compose(
      'MultilevelLinearComparativeView',
      BaseViewModel,
      types.model({
        id: ElementId,
        type: types.literal('MultilevelLinearComparativeView'),
        height: defaultHeight,
        trackSelectorType: 'hierarchical',
        showIntraviewLinks: true,
        linkViews: false,
        interactToggled: false,
        isDescending: true,
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        views: types.array(
          pluginManager.getViewType('LinearGenomeMultilevelView')
            .stateModel as LinearGenomeViewStateModel,
        ),
      }),
    )
    .volatile(() => ({
      headerHeight: 0,
      width: 800,
    }))
    .views(self => ({
      get initialized() {
        return self.views.length > 0
      },

      get refNames() {
        return self.views.map(v => [
          ...new Set(v.staticBlocks.map(m => m.refName)),
        ])
      },

      get assemblyNames() {
        return [...new Set(self.views.map(v => v.assemblyNames).flat())]
      },
    }))
    .actions(self => ({
      setLimitBpPerPx() {
        let prev = -1
        let next = 1
        self.views.forEach(view => {
          if (prev === -1) {
            // @ts-ignore
            view.setLimitBpPerPx(true, view.bpPerPx, view.bpPerPx)
          }
          if (next === self.views.length) {
            // @ts-ignore
            view.setLimitBpPerPx(false, view.bpPerPx, view.bpPerPx)
          }
          if (prev !== -1 && next !== self.views.length) {
            // @ts-ignore
            view.setLimitBpPerPx(
              true,
              self.views[prev].bpPerPx,
              self.views[next].bpPerPx,
            )
          }

          prev++
          next++
        })
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(self, param => {
            if (self.linkViews) {
              const { name, path, args } = param
              const actions = [
                'horizontalScroll',
                'zoomTo',
                'navToLocString',
                'setScaleFactor',
                'showTrack',
                'hideTrack',
                'toggleTrack',
                'moveIfAnchor',
              ]
              if (actions.includes(name) && path) {
                this.onSubviewAction(name, path, args)
              }
            }
          }),
        )
      },

      // automatically removes session assemblies associated with this view
      // e.g. read vs ref
      beforeDestroy() {
        const session = getSession(self)
        self.assemblyNames.forEach(name => {
          if (name.endsWith('-temp')) {
            session.removeAssembly?.(name)
          }
        })
      },

      onSubviewAction(actionName: string, path: string, args: any[] = []) {
        // @ts-ignore
        const anchorViewIndex = self.views.findIndex(view => view.isAnchor)
        // @ts-ignore
        const overviewIndex = self.views.findIndex(view => view.isOverview)
        if (actionName === 'horizontalScroll') {
          self.views.forEach(view => {
            if (view.initialized) {
              // scroll is proportionate to the view's relation to the anchor view
              const movement =
                view.bpPerPx !== 0
                  ? args[0] *
                    (self.views[anchorViewIndex].bpPerPx / view.bpPerPx)
                  : 0
              // @ts-ignore
              view[actionName](movement)

              const ret = getPath(view)
              // reverse action for the view you're scrolling on
              if (ret.lastIndexOf(path) === ret.length - path.length) {
                // @ts-ignore
                view[actionName](args[0] * -1)
              }
            }
          })
        }

        if (actionName === 'zoomTo') {
          self.views.forEach(view => {
            if (path.endsWith(anchorViewIndex.toString())) {
              // @ts-ignore
              if (!view.isAnchor && !view.isOverview) {
                if (view.initialized) {
                  // @ts-ignore
                  view.setLimitBpPerPx(false)
                  const rev = view.bpPerPx
                  const factor =
                    view.bpPerPx !== 0
                      ? args[0] /
                        (self.views[anchorViewIndex].bpPerPx / view.bpPerPx)
                      : 0
                  // @ts-ignore
                  view[actionName](factor)
                  const ret = getPath(view)
                  // reverse action for the view you're zooming on
                  if (ret.lastIndexOf(path) === ret.length - path.length) {
                    // @ts-ignore
                    view[actionName](rev)
                  }

                  const center = self.views[anchorViewIndex].pxToBp(
                    view.width / 2,
                  )
                  view.centerAt(center.coord, center.refName, center.index)
                }
              }
            }
          })
          self.setLimitBpPerPx()
        }

        if (actionName === 'navToLocString') {
          self.views[anchorViewIndex][actionName](args[0])
          self.views.forEach(view => {
            if (view.initialized) {
              // @ts-ignore
              view.setLimitBpPerPx(false)
            }
          })
          self.views.forEach(view => {
            if (view.initialized) {
              // @ts-ignore
              if (!view.isAnchor) {
                const center = self.views[anchorViewIndex].pxToBp(
                  view.width / 2,
                )
                const targetBp =
                  view.bpPerPx !== 0
                    ? self.views[anchorViewIndex].bpPerPx /
                      // @ts-ignore
                      (self.views[anchorViewIndex].limitBpPerPx.upperLimit /
                        view.bpPerPx)
                    : 0
                view.navToLocString(center.refName)
                view.zoomTo(targetBp)
                view.centerAt(center.coord, center.refName, center.index)
              }
            }
          })
          self.setLimitBpPerPx()
        }

        if (actionName === 'moveIfAnchor') {
          self.views.forEach(view => {
            if (view.initialized) {
              // @ts-ignore
              view.moveIfAnchor(args[0], args[1])
              // @ts-ignore
              view.setLimitBpPerPx(false)
            }
          })
          self.views.forEach(view => {
            if (view.initialized) {
              // @ts-ignore
              if (!view.isAnchor && !view.isOverview) {
                const center = self.views[anchorViewIndex].pxToBp(
                  view.width / 2,
                )
                const targetBp =
                  view.bpPerPx !== 0
                    ? self.views[anchorViewIndex].bpPerPx /
                      // @ts-ignore
                      (self.views[anchorViewIndex].limitBpPerPx.upperLimit /
                        view.bpPerPx)
                    : 0
                view.navToLocString(center.refName)
                view.zoomTo(targetBp)
                view.centerAt(center.coord, center.refName, center.index)
              }
            }
          })
          self.setLimitBpPerPx()

          // center the overview
          const center = self.views[anchorViewIndex].pxToBp(
            self.views[overviewIndex].width / 2,
          )
          self.views[overviewIndex].navToLocString(center.refName)
          self.views[overviewIndex].centerAt(
            center.coord,
            center.refName,
            center.index,
          )
        }
      },

      setWidth(newWidth: number) {
        self.width = newWidth
        self.views.forEach(v => v.setWidth(newWidth))
      },

      setHeight(newHeight: number) {
        self.height = newHeight
      },

      setViews(views: SnapshotIn<LinearGenomeViewModel>[]) {
        self.views = cast(views)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      setIsDescending(toggle: boolean) {
        self.isDescending = toggle
      },

      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },

      alignViews() {
        // @ts-ignore
        const anchorViewIndex = self.views.findIndex(view => view.isAnchor)
        self.views.forEach(view => {
          const center = self.views[anchorViewIndex].pxToBp(view.width / 2)
          const targetBp = view.bpPerPx
          view.navToLocString(center.refName)
          view.zoomTo(targetBp)
          view.centerAt(center.coord, center.refName, center.index)
        })
      },
    }))
    .views(self => ({
      menuItems() {
        const menuItems: MenuItem[] = []
        menuItems.push({
          label: 'Return to import form',
          onClick: () => {
            getSession(self).queueDialog(handleClose => [
              ReturnToImportFormDialog,
              { model: self, handleClose },
            ])
          },
          icon: FolderOpenIcon,
        })
        const subMenuItems: MenuItem[] = []
        self.views.forEach((view, idx) => {
          if (view.menuItems?.()) {
            const label = view.displayName
              ? `${view.displayName} Menu`
              : `View ${idx + 1} Menu`
            subMenuItems.push({
              label: label,
              subMenu: view.menuItems(),
            })
          }
        })
        if (subMenuItems.length > 0) {
          menuItems.push({
            label: 'View Menus',
            subMenu: subMenuItems,
            icon: MenuIcon,
          })
        }
        return menuItems
      },
    }))
}

export type MultilevelLinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultilevelLinearComparativeViewModel =
  Instance<MultilevelLinearComparativeViewStateModel>
