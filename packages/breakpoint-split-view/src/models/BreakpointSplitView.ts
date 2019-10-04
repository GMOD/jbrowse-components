/* eslint-disable @typescript-eslint/explicit-function-return-type */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import intersection from 'array-intersection'

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
        const tracks = self.views
          .map(view => view.getTrack(trackConfigId))
          .filter(f => !!f)
        if (!tracks.length) return []
        const adder = (f: Feature) => {
          if (!alreadySeen[f.id()]) {
            const n = f.get('name')
            if (!candidates[n]) {
              candidates[n] = []
            }
            candidates[n].push(f)
          }
          alreadySeen[f.id()] = true
        }

        for (const value of new CompositeMap<string, Feature>(
          tracks.map(t => t.features),
        ).values()) {
          console.log(value)
          adder(value)
        }

        return Object.values(candidates).filter(v => v.length > 1)
      },

      getLayoutMatches(trackConfigId: string) {
        const tracks = self.views.map(view => view.getTrack(trackConfigId))
        const metaLayoutFeatures = new CompositeMap(
          tracks.map(t => t.layoutFeatures),
        )
        const matches = this.getMatchedFeatures(trackConfigId)
        return matches.map(c => {
          return c
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
            .sort((a, b) => a.clipPos - b.clipPos)
        })
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
