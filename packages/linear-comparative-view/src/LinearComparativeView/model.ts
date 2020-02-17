/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getSession } from '@gmod/jbrowse-core/util'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { transaction } from 'mobx'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { readConfObject } from '@gmod/jbrowse-core/configuration'

export type LayoutRecord = [number, number, number, number]

type LGV = Instance<LinearGenomeViewStateModel>
type ConfigRelationship = { type: string; target: string }

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const {
    types: jbrequiredTypes,
    getParent,
    onAction,
    addDisposer,
    resolveIdentifier,
    getPath,
  } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')

  const minHeight = 40
  const defaultHeight = 400
  return (jbrequiredTypes as Instance<typeof types>)
    .model('LinearComparativeView', {
      id: ElementId,
      type: types.literal('LinearComparativeView'),
      headerHeight: 0,
      width: 800,
      height: types.optional(
        types.refinement(
          'viewHeight',
          types.number,
          (n: number) => n >= minHeight,
        ),
        defaultHeight,
      ),
      displayName: 'synteny detail',
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: false,
      interactToggled: false,
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel') as any,
      ),
      views: types.array(
        pluginManager.getViewType('LinearGenomeView')
          .stateModel as LinearGenomeViewStateModel,
      ),
    })
    .views(self => ({
      get controlsWidth() {
        return self.views.length ? self.views[0].controlsWidth : 0
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
        const tracks = trackIds.map(t => resolveIdentifier(getSession(self), t))
        return new CompositeMap<string, Feature>(tracks.map(t => t.features))
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          onAction(
            self,
            ({
              name,
              path,
              args,
            }: {
              name: string
              path: string
              args: any[]
            }) => {
              if (self.linkViews) {
                if (['horizontalScroll', 'zoomTo'].includes(name)) {
                  this.onSubviewAction(name, path, args)
                }
              }
            },
          ),
        )
      },

      onSubviewAction(actionName: string, path: string, args: any[]) {
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

      removeView(view: LGV) {
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
          const session: any = getSession(self)
          const selector = session.addDrawerWidget(
            'HierarchicalTrackSelectorDrawerWidget',
            'hierarchicalTrackSelector',
            { view: self },
          )
          session.showDrawerWidget(selector)
          return selector
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
}

export type LinearComparativeView = ReturnType<typeof stateModelFactory>
export type LinearComparativeViewModel = Instance<LinearComparativeView>
