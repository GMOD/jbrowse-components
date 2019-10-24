import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import intersection from 'array-intersection'

type LGV = Instance<LinearGenomeViewStateModel>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const { types: jbrequiredTypes, getParent, getRoot } = jbrequire(
    'mobx-state-tree',
  )
  const { ElementId } = jbrequire('@gmod/jbrowse-core/mst-types')
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const configSchema = ConfigurationSchema(
    'BreakpointSplitView',
    {},
    { explicitlyTyped: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = (jbrequiredTypes as Instance<typeof types>)
    .model('BreakpointSplitView', {
      id: ElementId,
      type: types.literal('BreakpointSplitView'),
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
      displayName: 'breakpoint detail',
      configuration: configSchema,
      trackSelectorType: 'hierarchical',

      views: types.array(pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel),
    })
    .views(self => ({
      get controlsWidth() {
        return self.views[0].controlsWidth
      },

      get matchedTracks(): string[] {
        const viewTracks = self.views.map(view =>
          view.tracks.map(t => t.configuration.configId),
        )
        return intersection(...viewTracks)
      },

      // finds tracks with a given trackId across multiple views
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
      },

      // returns a list of features that "match" across views,
      // applies to a specific trackId
      getMatchedFeatures(trackConfigId: string) {
        // TODO: extend to handle different trackIds e.g.
        // in a synteny scenario with different tracks
        const tracks = this.getMatchedTracks(trackConfigId)
        const features = new CompositeMap<string, Feature>(
          tracks.map(t => t.features),
        )
        console.log('here', tracks[0].type)
        if (tracks[0].type === 'AlignmentsTrack')
          return this.getMatchedAlignmentFeatures(features)
        if (tracks[0].type === 'VariantTrack') {
          console.log(tracks)
          return this.getMatchedVariantFeatures(features)
        }

        return { features: [], type: 'None' }
      },

      // this finds candidate variant features to plot,
      // currently only breakends (could do intrachromosomal deletions, insertions, other SV
      // if relevant too
      getMatchedVariantFeatures(features: CompositeMap<string, Feature>) {
        const candidates: Record<string, Feature[]> = {}
        for (const feature of features.values()) {
          // TODO: handle other variant types
          if (feature.get('type') == 'breakend') {
            candidates[feature.id()] = [feature]
          }
        }
        console.log(candidates)

        return {
          features: Object.values(candidates),
          type: 'Breakends',
        }
      },

      // this finds candidate alignment features, aimed at plotting split reads
      // from BAM/CRAM files
      getMatchedAlignmentFeatures(features: CompositeMap<string, Feature>) {
        const candidates: Record<string, Feature[]> = {}
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

        // get only features appearing more than once
        return {
          features: Object.values(candidates).filter(v => v.length > 1),
          type: 'Alignments',
        }
      },

      getMatchedFeaturesInLayout(trackConfigId: string) {
        const { features, type } = this.getMatchedFeatures(trackConfigId)
        let ret
        if (type == 'Alignments') {
          ret = this.getMatchedAlignmentsInLayout(trackConfigId, features)
        } else if (type == 'Breakends') {
          ret = this.getMatchedBreakendsInLayout(trackConfigId, features)
        }
        return { type, features: ret }
      },
      getMatchedBreakendsInLayout(
        trackConfigId: string,
        features: Feature[][],
      ) {
        const tracks = this.getMatchedTracks(trackConfigId)
        return features.map(c => {
          return c.map((feature: Feature) => {
            let layout: [number, number, number, number] | undefined
            const level = tracks.findIndex(track => {
              layout = track.layoutFeatures.get(feature.id())
              return layout
            })
            return {
              feature,
              layout,
              level,
            }
          })
        })
      },
      getMatchedAlignmentsInLayout(
        trackConfigId: string,
        features: Feature[][],
      ) {
        const tracks = this.getMatchedTracks(trackConfigId)
        return features.map(c =>
          c
            .map((feature: Feature) => {
              const mismatches = feature.get('mismatches')
              let clipPos = 0
              let layout: [number, number, number, number] | undefined
              const level = tracks.findIndex(track => {
                layout = track.layoutFeatures.get(feature.id())
                return layout
              })
              const record =
                feature.get('strand') === -1
                  ? mismatches[mismatches.length - 1]
                  : mismatches[0]
              if (record.type === 'softclip' || record.type === 'hardclip') {
                clipPos = record.cliplen
              }
              return {
                feature,
                layout,
                level,
                clipPos,
              }
            })
            .sort((a, b) => a.clipPos - b.clipPos),
        )
      },
    }))
    .actions(self => ({
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

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },
    }))

  return { stateModel, configSchema }
}

export type BreakpointView = ReturnType<typeof stateModelFactory>
export type BreakpointViewStateModel = BreakpointView['stateModel']
