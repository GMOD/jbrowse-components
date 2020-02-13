/* eslint-disable @typescript-eslint/no-explicit-any */
import CompositeMap from '@gmod/jbrowse-core/util/compositeMap'
import { getSession } from '@gmod/jbrowse-core/util'
import { doesIntersect2 } from '@gmod/jbrowse-core/util/range'
import { LinearGenomeViewStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/LinearGenomeView'
import { BaseTrackStateModel } from '@gmod/jbrowse-plugin-linear-genome-view/src/BasicTrack/baseTrackModel'
import { types, Instance } from 'mobx-state-tree'
import { autorun, transaction } from 'mobx'
import SimpleFeature, { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { getConf, readConfObject } from '@gmod/jbrowse-core/configuration'

export type LayoutRecord = [number, number, number, number]
export interface SimpleAnchorsData {
  [key: number]: {
    name1: string
    name2: string
    name3: string
    name4: string
    score: number
    strand: string
  }
}
export interface AnchorsData {
  [key: number]: {
    name1: string
    name2: string
    score: number
  }
}
export interface PafRecord {
  chr1: string
  start1: number
  end1: number
  strand1: string
  chr2: string
  start2: number
  end2: number
}

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
  const { ConfigurationSchema } = jbrequire('@gmod/jbrowse-core/configuration')
  const configSchema = ConfigurationSchema(
    'LinearComparativeView',
    {
      anchors: {
        type: 'string',
        defaultValue: '',
      },
      simpleAnchors: {
        type: 'string',
        defaultValue: '',
      },
      paf: {
        type: 'string',
        defaultValue: '',
      },
      sam: {
        type: 'string',
        defaultValue: '',
      },
      middle: {
        type: 'boolean',
        defaultValue: false,
      },
      hideTiny: {
        type: 'boolean',
        defaultValue: false,
      },
      showAnchors: {
        type: 'boolean',
        defaultValue: true,
      },
      showSimpleAnchors: {
        type: 'boolean',
        defaultValue: true,
      },
      showPaf: {
        type: 'boolean',
        defaultValue: true,
      },
      showSam: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    { explicitlyTyped: true, implicitIdentifier: true },
  )

  const minHeight = 40
  const defaultHeight = 400
  const stateModel = (jbrequiredTypes as Instance<typeof types>)
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
      configuration: configSchema,
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

      getFeaturesOverlappingBlock(
        data: PafRecord[] | undefined,
        assembly: number,
        block: { start: number; end: number; refName: string },
      ) {
        return (data || []).filter(row => {
          if (assembly === 0) {
            if (block.refName === row.chr1) {
              return doesIntersect2(
                block.start,
                block.end,
                row.start1,
                row.end1,
              )
            }
          } else if (assembly === 1) {
            if (block.refName === row.chr2) {
              return doesIntersect2(
                block.start,
                block.end,
                row.start2,
                row.end2,
              )
            }
          }
          return false
        })
      },

      getFeatures(data: any) {
        const r1t = self.views[0].staticBlocks.map(block => {
          return this.getFeaturesOverlappingBlock(data, 0, block)
        })
        const r1 = r1t.flat().map((row, i) => {
          return [
            {
              layout: [row.start1, 0, row.end1, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-1-1`,
                  start: row.start1,
                  end: row.end1,
                },
              }),
              level: 0,
              refName: row.chr1,
            },
            {
              layout: [row.start2, 0, row.end2, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-1-2`,
                  start: row.start2,
                  end: row.end2,
                },
              }),
              level: 1,
              refName: row.chr2,
            },
          ]
        })

        const r2t = self.views[1].staticBlocks.map(block => {
          return this.getFeaturesOverlappingBlock(data, 1, block)
        })

        const r2 = r2t.flat().map((row, i) => {
          return [
            {
              layout: [row.start1, 0, row.end1, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-2-1`,
                  start: row.start1,
                  end: row.end1,
                },
              }),
              level: 0,
              refName: row.chr1,
            },
            {
              layout: [row.start2, 0, row.end2, 10] as LayoutRecord,
              feature: new SimpleFeature({
                data: {
                  uniqueId: `${i}-2-2`,
                  start: row.start2,
                  end: row.end2,
                },
              }),
              level: 1,
              refName: row.chr2,
            },
          ]
        })

        return r1.concat(r2)
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

      activateConfigurationUI() {
        // @ts-ignore
        getSession(self).editConfiguration(self.configuration)
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

  return { stateModel, configSchema }
}

export type LinearComparativeView = ReturnType<typeof stateModelFactory>
export type LinearComparativeViewStateModel = LinearComparativeView['stateModel']
export type LinearComparativeViewModel = Instance<
  LinearComparativeViewStateModel
>
