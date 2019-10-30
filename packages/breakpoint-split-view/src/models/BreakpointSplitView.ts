import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import intersection from 'array-intersection'
import isObject from 'is-object'

type LGV = Instance<LinearGenomeViewStateModel>
interface Breakend {
  MateDirection: string
  Join: string
  Replacement: string
  MatePosition: string
}
export interface BSVMenuOption {
  title: string
  key: string
  callback: Function
  checked?: boolean
  isCheckbox: boolean
}

export type LayoutRecord = [number, number, number, number]

interface LinkViewArgs {
  name: string
  path: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const {
    types: jbrequiredTypes,
    getParent,
    getRoot,
    onAction,
    addDisposer,
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
      linkViews: false,
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
        if (tracks.length) {
          const features = new CompositeMap<string, Feature>(
            tracks.map(t => t.features),
          )
          if (tracks[0].type === 'AlignmentsTrack')
            return this.getMatchedAlignmentFeatures(features)
          if (tracks[0].type === 'VariantTrack') {
            return this.getMatchedVariantFeatures(features)
          }
        }

        return { features: [], type: 'None' }
      },

      // this finds candidate variant features to plot,
      // currently only breakends (could do intrachromosomal deletions, insertions, other SV
      // if relevant too
      getMatchedVariantFeatures(features: CompositeMap<string, Feature>) {
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

        return {
          features: Object.values(candidates).filter(v => v.length > 1),
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

        return {
          features: Object.values(candidates).filter(v => v.length > 1),
          type: 'Alignments',
        }
      },

      getMatchedFeaturesInLayout(trackConfigId: string) {
        const { features, type } = this.getMatchedFeatures(trackConfigId)
        let ret
        if (type === 'Alignments') {
          ret = this.getMatchedAlignmentsInLayout(trackConfigId, features)
        } else if (type === 'Breakends') {
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
              let layout: [number, number, number, number] | undefined
              const level = tracks.findIndex(track => {
                layout = track.layoutFeatures.get(feature.id())
                return layout
              })
              const clipPos = feature.get('clipPos')
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
      afterAttach() {
        addDisposer(
          self,
          onAction(self, ({ name, path, args }: LinkViewArgs) => {
            if (name === 'horizontalScroll') {
              this.onSubviewHorizontalScroll(path, args)
            } else if (name === 'zoomTo') {
              this.onSubviewZoom(path, args)
            }
          }),
        )
      },

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSubviewHorizontalScroll(path: string, args: any[]) {
        self.views.forEach(view => {
          view.horizontalScroll(args[0])
        })
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSubviewZoom(path: string, args: any[]) {
        self.views.forEach(view => {
          view.zoomTo(args[0])
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

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },

      toggleLinkViews() {
        self.linkViews = !self.linkViews
      },
    }))
    .views(self => ({
      get menuOptions(): BSVMenuOption[] {
        return [
          {
            title: 'Link views',
            key: 'flip',
            callback: self.toggleLinkViews,
            checked: self.linkViews,
            isCheckbox: true,
          },
        ]
      },
    }))

  return { stateModel, configSchema }
}

export type BreakpointView = ReturnType<typeof stateModelFactory>
export type BreakpointViewStateModel = BreakpointView['stateModel']
