/* eslint-disable @typescript-eslint/no-explicit-any */
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { MenuItem } from '@jbrowse/core/ui'
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
} from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

import { ElementId } from '@jbrowse/core/util/types/mst'

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
        self.assemblyNames.forEach(name => {
          if (name.endsWith('-temp')) {
            session.removeAssembly?.(name)
          }
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
        self.views.forEach(v => v.setWidth(newWidth))
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

      toggleInteract() {
        self.interactToggled = !self.interactToggled
      },
      toggleIntraviewLinks() {
        self.showIntraviewLinks = !self.showIntraviewLinks
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
        const trackConfigSchema =
          pluginManager.pluggableConfigSchemaType('track')
        const configuration = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
        const trackType = pluginManager.getTrackType(configuration.type)
        if (!trackType) {
          throw new Error(`unknown track type ${configuration.type}`)
        }
        const viewType = pluginManager.getViewType(self.type)
        const supportedDisplays = viewType.displayTypes.map(
          displayType => displayType.name,
        )
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
        const trackConfigSchema =
          pluginManager.pluggableConfigSchemaType('track')
        const config = resolveIdentifier(
          trackConfigSchema,
          getRoot(self),
          trackId,
        )
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(t => t.configuration === config)
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
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
          label: 'Open track selector',
          onClick: self.activateTrackSelector,
          icon: TrackSelectorIcon,
        })
        return menuItems
      },
    }))
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel =
  Instance<LinearComparativeViewStateModel>
