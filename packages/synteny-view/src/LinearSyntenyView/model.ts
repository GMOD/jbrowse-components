/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getSession } from '@gmod/jbrowse-core/util'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import { types, Instance } from 'mobx-state-tree'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getConf } from '@gmod/jbrowse-core/configuration'

export type LayoutRecord = [number, number, number, number]

type LGV = Instance<LinearGenomeViewStateModel>
type ConfigRelationship = { type: string; target: string }
// Get the syntenyGroup type from the tracks configRelationships
function getSyntenyGroup(track: Instance<BaseTrackStateModel>) {
  const rels: ConfigRelationship[] = getConf(track, 'configRelationships')
  const t = rels.find(f => f.type === 'syntenyGroup')
  return t ? t.target : undefined
}
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
    'LinearSyntenyView',
    {
      mcscan: {
        type: 'boolean',
        defaultValue: false,
      },
    },
    { explicitlyTyped: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = (jbrequiredTypes as Instance<typeof types>)
    .model('LinearSyntenyView', {
      id: ElementId,
      type: types.literal('LinearSyntenyView'),
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
    .volatile(self => ({
      mcscanData: undefined as any,
      mcscanLookupData: undefined as any,
    }))
    .views(self => ({
      get controlsWidth() {
        return self.views.length ? self.views[0].controlsWidth : 0
      },

      // Looks at the syntenyGroup type in the configRelationships and determines
      // all the unique ones
      get syntenyGroups(): string[] {
        const groups = new Set<string>()
        self.views.forEach(view => {
          view.tracks.forEach(track => {
            const g = getSyntenyGroup(track)
            if (g) groups.add(g)
          })
        })
        return Array.from(groups)
      },

      get assemblyNames() {
        return [...new Set(self.views.map(v => v.assemblyNames).flat())]
      },

      // Get tracks with a given syntenyGroup across multiple views
      getMatchedTracks(syntenyGroup: string) {
        return self.views.map(view =>
          view.tracks.find(track => getSyntenyGroup(track) === syntenyGroup),
        )
      },

      // Get tracks with a given syntenyGroup across multiple views
      getSyntenyTrackFromView(view: LGV, syntenyGroup: string) {
        return view.tracks.find(
          track => getSyntenyGroup(track) === syntenyGroup,
        )
      },

      // Get a composite map of featureId->feature map for a track
      // across multiple views
      getTrackFeatures(syntenyGroup: string) {
        const tracks = this.getMatchedTracks(syntenyGroup).filter(f => !!f)
        return new CompositeMap<string, Feature>(tracks.map(t => t.features))
      },

      get allMatchedSyntenyFeatures() {
        const r: { [key: string]: Feature[][] } = {}
        this.syntenyGroups.forEach(group => {
          r[group] = this.getMatchedSyntenyFeatures(group)
        })
        return r
      },

      get allMatchedMCScanFeatures() {
        const r: { [key: string]: string[] } = {}
        this.syntenyGroups.forEach(group => {
          // @ts-ignore
          r[group] = this.getMCScanFeatures(group)
        })
        return r
      },

      // This finds candidate syntenic connections
      getMCScanFeatures(syntenyGroup: string) {
        const features = this.getTrackFeatures(syntenyGroup)
        const alreadySeen = new Set<string>()
        const featNameMap: any = {}

        // this finds candidate features that share the same name
        for (const feature of features.values()) {
          const n = self.mcscanData[feature.get('name')]
          featNameMap[feature.get('name')] = feature

          if (n) {
            alreadySeen.add(n)
          }
        }

        const blocks = Array.from(alreadySeen)
        const ret = []
        for (const block of blocks) {
          const r = self.mcscanLookupData[block]
          if (r) {
            const r1 = featNameMap[r.name1]
            const r2 = featNameMap[r.name2]
            const r3 = featNameMap[r.name3]
            const r4 = featNameMap[r.name4]
            if (!(r1 && r2) || !(r3 && r4)) continue
            const s1 = Math.min(r1.get('start'), r2.get('start'))
            const e1 = Math.max(r1.get('end'), r2.get('end'))
            const s2 = Math.min(r3.get('start'), r4.get('start'))
            const e2 = Math.max(r3.get('end'), r4.get('end'))

            ret.push([
              {
                layout: [s1, 0, e1, 10],
                feature: new SimpleFeature({
                  data: { uniqueId: `${block}-1`, start: s1, end: e1 },
                }),
                level: 1,
                block: { refName: r1.get('refName') },
              },
              {
                layout: [s2, 0, e2, 10],
                feature: new SimpleFeature({
                  data: { uniqueId: `${block}-2`, start: s2, end: e2 },
                }),
                level: 0,
                block: { refName: r3.get('refName') },
              },
            ])
          }
        }
        return ret
      },

      // This finds candidate syntenic connections
      getMatchedSyntenyFeatures(syntenyGroup: string) {
        const features = this.getTrackFeatures(syntenyGroup)
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

      getMatchedFeaturesInLayout(syntenyGroup: string, features: Feature[][]) {
        const tracks = this.getMatchedTracks(syntenyGroup)
        return features.map(c =>
          c.map((feature: Feature) => {
            let layout: LayoutRecord | undefined
            let block: any
            const level = tracks.findIndex(track => {
              if (track) {
                layout = track.layoutFeatures.get(feature.id())
                block = track.featToBlock[feature.id()]
                return layout
              }
              return undefined
            })
            return {
              feature,
              block,
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

      removeView(view: LGV) {
        self.views.remove(view)
      },

      setMCScanData(mcscanData: any, mcscanLookupData: any) {
        self.mcscanData = mcscanData
        self.mcscanLookupData = mcscanLookupData
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
    }))

  return { stateModel, configSchema }
}

export type LinearSyntenyView = ReturnType<typeof stateModelFactory>
export type LinearSyntenyViewStateModel = LinearSyntenyView['stateModel']
export type LinearSyntenyViewModel = Instance<LinearSyntenyViewStateModel>
