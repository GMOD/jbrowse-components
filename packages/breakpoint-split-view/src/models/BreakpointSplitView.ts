/* eslint-disable @typescript-eslint/explicit-function-return-type */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { types, Instance } from 'mobx-state-tree'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function stateModelFactory(pluginManager: any) {
  const { jbrequire } = pluginManager
  const {
    types: jbrequiredTypes,
    getParent,
    getRoot,
    addDisposer,
    onAction,
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

      topLGV: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
      bottomLGV: pluginManager.getViewType('LinearGenomeView')
        .stateModel as LinearGenomeViewStateModel,
    })
    .views(self => ({
      get controlsWidth() {
        return self.topLGV.controlsWidth
      },

      get matchedTracks() {
        const a = self.topLGV.tracks.map(t => t.configuration.configId)
        const b = self.bottomLGV.tracks.map(t => t.configuration.configId)
        return a.filter(t => b.includes(t))
      },

      getMatchedFeatures(trackConfigId: string) {
        const candidates: Record<string, Feature[]> = {}
        const alreadySeen: Record<string, boolean> = {}
        const t1 = self.topLGV.getTrack(trackConfigId)
        const t2 = self.bottomLGV.getTrack(trackConfigId)
        if (!t1 && !t2) {
          return []
        }
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

        for (const f of new CompositeMap<string, Feature>([
          t1.features,
          t2.features,
        ]).values()) {
          adder(f)
        }

        return Object.values(candidates).filter(v => v.length > 1)
      },

      getLayoutMatches(trackConfigId: string) {
        const t1 = self.topLGV.getTrack(trackConfigId)
        const t2 = self.bottomLGV.getTrack(trackConfigId)
        const m = new CompositeMap([t1.layoutFeatures, t2.layoutFeatures])
        const t = this.getMatchedFeatures(trackConfigId)
        return t.map(c => {
          return c
            .map((f: Feature) => ({
              feature: f,
              layout: m.get(f.id()),
              level: t1.layoutFeatures.get(f.id()) ? 0 : 1,
              clipPos: +(f.get('CIGAR').match(/^(\d+)([SH])/) || [])[1] || 0,
            }))
            .sort((a, b) => a.clipPos - b.clipPos)
        })
      },
    }))
    .actions(self => ({
      afterAttach() {
        // add an onAction listener to listen to actions being taken on the sub-views
        // and dispatch our own actions to keep the views in sync
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              args: any[]
            }) => {
              // if (name === 'horizontalScroll') {
              //   // console.log(path, args)
              //   self.onSubviewHorizontalScroll(path, args)
              // } else if (name === 'zoomTo') {
              //   // console.log(path, args)
              //   self.onSubviewZoom(path, args)
              // }
            },
          ),
        )
      },

      // binds the horizontal scrolling of the two LGVs together
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSubviewHorizontalScroll(path: string, args: any[]) {
        if (path === '/topLGV') {
          self.bottomLGV.horizontalScroll(args[0])
        } else if (path === '/bottomLGV') {
          self.topLGV.horizontalScroll(args[0])
        }
      },

      // binds the zooming of the two LGVs together
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onSubviewZoom(path: string, args: any[]) {
        if (path === '/topLGV') {
          self.bottomLGV.zoomTo(args[0])
        } else if (path === '/bottomLGV') {
          self.topLGV.zoomTo(args[0])
        }
      },

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
