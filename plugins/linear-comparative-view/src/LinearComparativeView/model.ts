/* eslint-disable @typescript-eslint/no-explicit-any */
import { autorun } from 'mobx'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { MenuItem, ReturnToImportFormDialog } from '@jbrowse/core/ui'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import { transaction } from 'mobx'
import PluginManager from '@jbrowse/core/PluginManager'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
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
  IAnyModelType,
} from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'

export default function stateModelFactory(pluginManager: PluginManager) {
  const defaultHeight = 400
  return types
    .compose(
      'LinearComparativeView',
      BaseViewModel,
      types.model({
        id: ElementId,
        type: types.literal('LinearComparativeView'),
        height: defaultHeight,
        trackSelectorType: 'hierarchical',
        showIntraviewLinks: true,
        linkViews: false,
        interactToggled: false,
        middleComparativeHeight: 100,
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        ),

        // this represents tracks specific to this view specifically used for
        // read vs ref dotplots where this track would not really apply
        // elsewhere
        viewTrackConfigs: types.array(
          pluginManager.pluggableConfigSchemaType('track'),
        ),
      }),
    )
    .volatile(() => ({
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
      afterAttach() {
        addDisposer(
          self,
          onAction(self, param => {
            if (self.linkViews) {
              const { name, path, args } = param
              const actions = [
                'horizontalScroll',
                'zoomTo',
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
        self.assemblyNames.forEach(asm => {
          session.removeTemporaryAssembly(asm)
        })
      },

      onSubviewAction(actionName: string, path: string, args: any[] = []) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (ret.lastIndexOf(path) !== ret.length - path.length) {
            // @ts-ignore
            view[actionName](args[0])
          }
        })
      },

      setWidth(newWidth: number) {
        self.width = newWidth
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
        getParent<any>(self, 2).removeView(self)
      },

      setMiddleComparativeHeight(n: number) {
        self.middleComparativeHeight = n
        return self.middleComparativeHeight
      },

      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },

      activateTrackSelector() {
        if (self.trackSelectorType === 'hierarchical') {
          const session = getSession(self)
          if (isSessionModelWithWidgets(session)) {
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            session.showWidget(selector)
            return selector
          }
          return undefined
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
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
        const schema = pluginManager.pluggableConfigSchemaType(
          'track',
        ) as IAnyModelType
        const configuration = resolveIdentifier(schema, getRoot(self), trackId)
        if (!configuration) {
          throw new Error(`track not found ${trackId}`)
        }
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
      squareView() {
        const bpPerPxs = self.views.map(v => v.bpPerPx)
        const avg = bpPerPxs.reduce((a, b) => a + b, 0) / bpPerPxs.length
        self.views.forEach(view => {
          const center = view.pxToBp(view.width / 2)
          view.setNewView(avg, view.offsetPx)
          if (!center.refName) {
            return
          }
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
        self.views.forEach((view, idx) => {
          if (view.menuItems?.()) {
            menuItems.push({
              label: `View ${idx + 1} Menu`,
              subMenu: view.menuItems(),
            })
          }
        })
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
        menuItems.push({
          label: 'Open track selector',
          onClick: self.activateTrackSelector,
          icon: TrackSelectorIcon,
        })
        return menuItems
      },
      rubberBandMenuItems() {
        return [
          {
            label: 'Zoom to region(s)',
            onClick: () => {
              self.views.forEach(view => {
                const { leftOffset, rightOffset } = view
                if (leftOffset && rightOffset) {
                  view.moveTo(leftOffset, rightOffset)
                }
              })
            },
          },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            if (self.initialized) {
              self.views.forEach(v => v.setWidth(self.width))
            }
          }),
        )
      },
    }))
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>
