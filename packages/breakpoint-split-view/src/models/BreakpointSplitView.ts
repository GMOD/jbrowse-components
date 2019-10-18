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

      getMatchedFeatures(trackConfigId: string) {
        const candidates: Record<string, Feature[]> = {}
        const alreadySeen: Record<string, boolean> = {}

        // finds "matching tracks across views" but filters out if a particular
        // view does not have it (all views don't necessarily have to include it)
        const tracks = self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)

        // if it happens none of them have it, return null
        if (!tracks.length) return []

        // this finds candidate features that share the same name
        for (const feature of new CompositeMap<string, Feature>(
          tracks.map(t => t.features),
        ).values()) {
          if (!alreadySeen[feature.id()]) {
            const n = feature.get('name')
            if (!candidates[n]) {
              candidates[n] = []
            }
            // todo: this is a bit of a hack to have this here, but
            // it prevents for example a "gene track" drawing
            // lines between genes with the same name...only want
            // to pair alignments?
            if (feature.get('CIGAR')) {
              candidates[n].push(feature)
            }
          }
          alreadySeen[feature.id()] = true
        }

        // get only features appearing more than once
        return Object.values(candidates).filter(v => v.length > 1)
      },

      getLayoutMatches(trackConfigId: string) {
        const tracks = self.views.map(view => view.getTrack(trackConfigId))
        const metaLayoutFeatures = new CompositeMap(
          tracks.map(t => t.layoutFeatures),
        )
        return this.getMatchedFeatures(trackConfigId).map(c =>
          c
            .map((f: Feature) => ({
              feature: f,
              layout: metaLayoutFeatures.get(f.id()),
              level: tracks.findIndex(t => t.layoutFeatures.get(f.id())),
              clipPos:
                // match clipping from the start or end depending on the strand of the feature
                f.get('strand') === -1
                  ? +(f.get('CIGAR').match(/(\d+)[SH]$/) || [])[1] || 0
                  : +(f.get('CIGAR').match(/^(\d+)([SH])/) || [])[1] || 0,
            }))
            .sort((a, b) => a.clipPos - b.clipPos),
        )
      },
    }))
    .actions(self => ({
      setDisplayName(name: string) {
        self.displayName = name
        return self.displayName
      },

      setWidth(newWidth: number) {
        self.width = newWidth
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
