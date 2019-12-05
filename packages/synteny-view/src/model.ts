/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getConf } from '@gmod/jbrowse-core/configuration'
import intersection from 'array-intersection'

export type LayoutRecord = [number, number, number, number]

export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const {
    types: jbrequiredTypes,
    getParent,
    getRoot,
    onAction,
    addDisposer,
    getPath,
  } = jbrequire('mobx-state-tree')
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const configSchema = ConfigurationSchema(
    'SyntenyView',
    {},
    { explicitlyTyped: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = (jbrequiredTypes as Instance<typeof types>)
    .model('SyntenyView', {
      id: ElementId,
      type: types.literal('SyntenyView'),
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
      configuration: configSchema,
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: false,
      interactToggled: false,
      views: types.array(pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel),
    })
    .views(self => ({
      get controlsWidth() {
        return self.views.length ? self.views[0].controlsWidth : 0
      },

      // Find all track ids that match across multiple views
      //
      // trackConfigId -> [other trackConfigIds]
      // find the ones that point at each other
      get matchedTracks(): string[] {
        const configRelationships = self.views.map(view =>
          view.tracks.map(t =>
            getConf(t, 'configRelationships').map(
              (r: { type: string; target: string }) => r.target,
            ),
          ),
        )
        return [...configRelationships].flat(2)
        // console.log(rels, configRelationships)
        // const ret = self.views.map(view => {
        //   return view.tracks.filter(t => {
        //     return rels.includes(getConf(t, 'configId'))
        //   })
        // })
        // console.log(ret)
        // return intersection(...ret)
      },

      // Get tracks with a given trackId across multiple views
      getMatchedTracks(trackConfigIds: string[]) {
        const tracks: any[] = []
        self.views.forEach(view => {
          trackConfigIds.forEach(trackConfigId => {
            const t = this.findTrack(trackConfigId)
            if (t) tracks.push(t)
          })
        })
        return tracks
      },

      // Get a composite map of featureId->feature map for a track
      // across multiple views
      getTrackFeatures(trackConfigIds: string[]) {
        const tracks = this.getMatchedTracks(trackConfigIds)
        return new CompositeMap<string, Feature>(
          (tracks || []).map(t => t.features),
        )
      },

      findTrack(trackConfigId: string) {
        let t: any
        self.views.forEach(v => {
          const ret = v.getTrack(trackConfigId)
          if (ret) t = ret
        })
        return t
      },

      // This finds candidate syntenic connections
      getMatchedSyntenyFeatures(trackConfigIds: string[]) {
        const features = this.getTrackFeatures(trackConfigIds)
        const candidates: { [key: string]: Feature[] } = {}
        const alreadySeen = new Set<string>()

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          if (!alreadySeen.has(feature.id())) {
            const n = feature.get('name')
            if (!candidates[n]) {
              candidates[n] = []
            }
            candidates[n].push(feature)
          }
          alreadySeen.add(feature.id())
        }

        return Object.values(candidates).filter(v => v.length > 1)
      },

      getMatchedFeaturesInLayout(
        trackConfigIds: string[],
        features: Feature[][],
      ) {
        const tracks = this.getMatchedTracks(trackConfigIds)
        return features.map(c =>
          c.map((feature: Feature) => {
            let layout: LayoutRecord | undefined
            const level = tracks.findIndex(track => {
              layout = track.layoutFeatures.get(feature.id())
              return layout
            })
            return {
              feature,
              layout,
              level,
            }
          }),
        )
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

      removeView(view: Instance<LinearGenomeViewStateModel>) {
        self.views.remove(view)
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      setHeaderHeight(height: number) {
        self.headerHeight = height
      },

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
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
    }))

  return { stateModel, configSchema }
}

export type SyntenyView = ReturnType<typeof stateModelFactory>
export type SyntenyViewStateModel = SyntenyView['stateModel']
export type SyntenyViewModel = Instance<SyntenyViewStateModel>
