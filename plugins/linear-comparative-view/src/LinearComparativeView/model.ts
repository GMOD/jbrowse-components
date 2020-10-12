/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@jbrowse/core/util/compositeMap'

import { MenuItem } from '@jbrowse/core/ui'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util'
import {
  LinearGenomeViewModel,
  LinearGenomeViewStateModel,
  BaseTrackStateModel,
} from '@jbrowse/plugin-linear-genome-view'
import { transaction } from 'mobx'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import LineStyleIcon from '@material-ui/icons/LineStyle'
import {
  types,
  getParent,
  onAction,
  addDisposer,
  Instance,
  resolveIdentifier,
  getPath,
  SnapshotIn,
  cast,
  ISerializedActionCall,
} from 'mobx-state-tree'

export default function stateModelFactory(pluginManager: PluginManager) {
  const { jbrequire } = pluginManager
  const { ElementId } = jbrequire('@jbrowse/core/util/types/mst')

  const defaultHeight = 400
  return types
    .model('LinearComparativeView', {
      id: ElementId,
      type: types.literal('LinearComparativeView'),
      height: defaultHeight,
      displayName: 'synteny detail',
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: false,
      interactToggled: false,
      tracks: types.array(
        pluginManager.pluggableMstType(
          'track',
          'stateModel',
        ) as BaseTrackStateModel,
      ),
      views: types.array(
        pluginManager.getViewType('LinearGenomeView')
          .stateModel as LinearGenomeViewStateModel,
      ),

      // this represents tracks specific to this view
      // specifically used for read vs ref dotplots where
      // this track would not really apply elsewhere
      viewTrackConfigs: types.array(
        pluginManager.pluggableConfigSchemaType('track'),
      ),

      // this represents assemblies in the specialized
      // read vs ref dotplot view
      viewAssemblyConfigs: types.array(types.frozen()),
    })
    .volatile(() => ({
      headerHeight: 0,
      width: 800,
    }))
    .views(self => ({
      get initialized() {
        return self.views.length > 0
      },

      get refNames() {
        return (self.views || []).map(v => [
          ...new Set(v.staticBlocks.map(m => m.refName)),
        ])
      },

      get assemblyNames() {
        return [...new Set(self.views.map(v => v.assemblyNames).flat())]
      },

      // Get a composite map of featureId->feature map for a track
      // across multiple views
      getTrackFeatures(trackIds: string[]) {
        // @ts-ignore
        const tracks = trackIds.map(t => resolveIdentifier(getSession(self), t))
        return new CompositeMap<string, Feature>(tracks.map(t => t.features))
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(self, (param: ISerializedActionCall) => {
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

      onSubviewAction(actionName: string, path: string, args: any[] = []) {
        self.views.forEach(view => {
          const ret = getPath(view)
          if (ret.lastIndexOf(path) !== ret.length - path.length) {
            // @ts-ignore
            view[actionName](args[0])
          }
        })
      },

      setDisplayName(name: string) {
        self.displayName = name
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
            // @ts-ignore
            const selector = session.addWidget(
              'HierarchicalTrackSelectorWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
            // @ts-ignore
            session.showWidget(selector)
            return selector
          }
          return undefined
        }
        throw new Error(`invalid track selector type ${self.trackSelectorType}`)
      },

      toggleTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = this.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) this.showTrack(configuration)
      },

      showTrack(configuration: any, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) {
          throw new Error('track configuration has no `type` listed')
        }

        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)

        if (!trackType) {
          throw new Error(`unknown track type ${type}`)
        }
        self.tracks.push({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
      },

      hideTrack(configuration: any) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },
    }))
    .views(self => ({
      get menuItems(): MenuItem[] {
        const session = getSession(self)
        const menuItems: MenuItem[] = []
        self.views.forEach((view, idx) => {
          if (view.menuItems) {
            menuItems.push({
              label: `View ${idx + 1} Menu`,
              subMenu: view.menuItems,
            })
          }
        })
        menuItems.push({
          label: 'Open track selector',
          onClick: self.activateTrackSelector,
          icon: LineStyleIcon,
          disabled:
            isSessionModelWithWidgets(session) &&
            session.visibleWidget &&
            session.visibleWidget.id === 'hierarchicalTrackSelector' &&
            // @ts-ignore
            session.visibleWidget.view.id === self.id,
        })
        return menuItems
      },
    }))
}

export type LinearComparativeViewStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearComparativeViewModel = Instance<
  LinearComparativeViewStateModel
>
