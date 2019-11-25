/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import intersection from 'array-intersection'
import isObject from 'is-object'

export interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}

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
      get matchedTracks(): string[] {
        const viewTracks = self.views.map(view =>
          view.tracks.map(t => t.configuration.configId),
        )
        return intersection(...viewTracks)
      },

      // Get tracks with a given trackId across multiple views
      getMatchedTracks(trackConfigId: string) {
        return self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
      },

      // Paired reads are handled slightly differently than split reads
      hasPairedReads(trackConfigId: string) {
        return this.getTrackFeatures(trackConfigId).find(f =>
          f.get('multi_segment_first'),
        )
      },

      // Translocation features are handled differently
      // since they do not have a mate e.g. they are one sided
      hasTranslocations(trackConfigId: string) {
        return this.getTrackFeatures(trackConfigId).find(
          f => f.get('type') === 'translocation',
        )
      },

      // Get a composite map of featureId->feature map for a track
      // across multiple views
      getTrackFeatures(trackConfigId: string) {
        const tracks = this.getMatchedTracks(trackConfigId)
        return new CompositeMap<string, Feature>(
          (tracks || []).map(t => t.features),
        )
      },

      // Getting "matched" TRA means just return all TRA
      getMatchedTranslocationFeatures(trackId: string) {
        const features = this.getTrackFeatures(trackId)
        const feats: Feature[][] = []
        const alreadySeen = new Set<string>()

        for (const f of features.values()) {
          if (!alreadySeen.has(f.id())) {
            if (f.get('ALT')[0] === '<TRA>') {
              feats.push([f])
            }
          }
          alreadySeen.add(f.id())
        }

        return feats
      },

      // Returns paired BND features across multiple views by inspecting
      // the ALT field to get exact coordinate matches
      getMatchedBreakendFeatures(trackId: string) {
        const features = this.getTrackFeatures(trackId)
        const candidates: Record<string, Feature[]> = {}
        const alreadySeen = new Set<string>()

        for (const f of features.values()) {
          if (!alreadySeen.has(f.id())) {
            if (f.get('type') === 'breakend') {
              f.get('ALT').forEach((a: Breakend | string) => {
                const cur = `${f.get('refName')}:${f.get('start') + 1}`
                if (isObject(a)) {
                  const alt = a as Breakend
                  if (!candidates[cur]) {
                    candidates[alt.MatePosition] = [f]
                  } else {
                    candidates[cur].push(f)
                  }
                }
              })
            }
          }
          alreadySeen.add(f.id())
        }

        return Object.values(candidates).filter(v => v.length > 1)
      },

      // this finds candidate alignment features, aimed at plotting split reads
      // from BAM/CRAM files
      getMatchedAlignmentFeatures(trackId: string) {
        const features = this.getTrackFeatures(trackId)
        const candidates: Record<string, Feature[]> = {}
        const alreadySeen = new Set<string>()

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          if (!alreadySeen.has(feature.id()) && !feature.get('unmapped')) {
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

      // this finds candidate alignment features, aimed at plotting split reads
      // from BAM/CRAM files
      getBadlyPairedAlignments(trackId: string) {
        const features = this.getTrackFeatures(trackId)
        const candidates: Record<string, Feature[]> = {}
        const alreadySeen = new Set<string>()

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          if (
            !alreadySeen.has(feature.id()) &&
            !feature.get('multi_segment_all_correctly_aligned') &&
            !feature.get('unmapped')
          ) {
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

      getMatchedFeaturesInLayout(trackConfigId: string, features: Feature[][]) {
        const tracks = this.getMatchedTracks(trackConfigId)
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

export type BreakpointView = ReturnType<typeof stateModelFactory>
export type BreakpointViewStateModel = BreakpointView['stateModel']
export type BreakpointViewModel = Instance<BreakpointViewStateModel>
