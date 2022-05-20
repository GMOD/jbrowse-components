import { transaction } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  getPath,
  getRoot,
  onAction,
  resolveIdentifier,
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

import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
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
        anchorViewIndex: 0,
        overviewIndex: 1,
        isDescending: true,
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),
      }),
    )
    .volatile(() => ({
      headerHeight: 0,
      width: 800,
    }))
    .views(self => ({
      get highResolutionScaling() {
        return 2
      },
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
            view.setLimitBpPerPx(true, view.bpPerPx, view.bpPerPx)
          }
          if (prev !== -1 && next !== self.views.length) {
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
        if (actionName === 'horizontalScroll') {
          self.views.forEach(view => {
            if (view.initialized) {
              // scroll is proportionate to the view's relation to the anchor view
              const movement =
                view.bpPerPx !== 0
                  ? args[0] *
                    (self.views[self.anchorViewIndex].bpPerPx / view.bpPerPx)
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
          if (path.endsWith(self.anchorViewIndex.toString())) {
            self.views.forEach(view => {
              if (
                view.id !== self.views[self.anchorViewIndex].id &&
                view.id !== self.views[self.overviewIndex].id
              ) {
                if (view.initialized) {
                  view.setLimitBpPerPx(false)
                  const rev = view.bpPerPx
                  const factor =
                    view.bpPerPx !== 0
                      ? args[0] /
                        (self.views[self.anchorViewIndex].bpPerPx /
                          view.bpPerPx)
                      : 0
                  // @ts-ignore
                  view[actionName](factor)
                  const ret = getPath(view)
                  // reverse action for the view you're zooming on
                  if (ret.lastIndexOf(path) === ret.length - path.length) {
                    // @ts-ignore
                    view[actionName](rev)
                  }

                  const center = self.views[self.anchorViewIndex].pxToBp(
                    view.width / 2,
                  )
                  view.centerAt(center.coord, center.refName, center.index)
                }
              }
            })
            self.setLimitBpPerPx()
          }
        }

        if (actionName === 'navToLocString') {
          self.views.forEach(view => {
            if (view.initialized) {
              const ret = getPath(view)
              if (ret.lastIndexOf(path) === ret.length - path.length) {
                // @ts-ignore
                view[actionName](args[0])
              }
              const center = self.views[self.anchorViewIndex].pxToBp(
                view.width / 2,
              )
              const targetBp = view.bpPerPx
              view.navToLocString(center.refName)
              view.zoomTo(targetBp)
              view.centerAt(center.coord, center.refName, center.index)
            }
          })
        }
      },

      setWidth(newWidth: number) {
        self.width = newWidth
        self.views.forEach(v => v.setWidth(newWidth))
      },

      setInitialDisplayNames() {
        self.views[self.anchorViewIndex].setDisplayName('Details')
        self.views[self.overviewIndex].setDisplayName('Overview')
      },

      setAnchorViewIndex(index: number) {
        self.anchorViewIndex = index
      },

      setOverviewIndex(index: number) {
        self.overviewIndex = index
      },

      setHeight(newHeight: number) {
        self.height = newHeight
      },

      setViews(views: SnapshotIn<LinearGenomeViewModel>[]) {
        self.views = cast(views)
      },

      removeView(view: LinearGenomeViewModel) {
        self.views.remove(view)
      },

      closeView() {
        getParent(self, 2).removeView(self)
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

      toggleTrack(trackId: string) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(trackId)
        // if none had that configuration, turn one on
        if (!hiddenCount) {
          this.showTrack(trackId)
        }
      },

      showTrack(trackId: string, initialSnapshot = {}) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const configuration = resolveIdentifier(schema, getRoot(self), trackId)
        const trackType = pluginManager.getTrackType(configuration.type)
        if (!trackType) {
          throw new Error(`unknown track type ${configuration.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)
        const supportedDisplays = viewType.displayTypes.map(d => d.name)
        const displayConf = configuration.displays.find(
          (d: AnyConfigurationModel) => supportedDisplays.includes(d.type),
        )
        if (!displayConf) {
          throw new Error(
            `could not find a compatible display for view type ${self.type}`,
          )
        }
        self.tracks.push(
          trackType.stateModel.create({
            ...initialSnapshot,
            type: configuration.type,
            configuration,
            displays: [{ type: displayConf.type, configuration: displayConf }],
          }),
        )
      },

      hideTrack(trackId: string) {
        const schema = pluginManager.pluggableConfigSchemaType('track')
        const config = resolveIdentifier(schema, getRoot(self), trackId)
        const shownTracks = self.tracks.filter(t => t.configuration === config)
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
      alignViews() {
        console.log(self.anchorViewIndex)
        self.views.forEach(view => {
          const center = self.views[self.anchorViewIndex].pxToBp(view.width / 2)
          const targetBp = view.bpPerPx
          view.navToLocString(center.refName)
          view.zoomTo(targetBp)
          view.centerAt(center.coord, center.refName, center.index)
        })
      },
      clearView() {
        self.views = cast([])
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
