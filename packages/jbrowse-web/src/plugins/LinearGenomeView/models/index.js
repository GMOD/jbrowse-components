import { transaction } from 'mobx'
import {
  flow,
  getParent,
  getRoot,
  getType,
  isStateTreeNode,
  types,
  getSnapshot,
} from 'mobx-state-tree'
import { getConf, readConfObject } from '../../../configuration'
import { ElementId, Region } from '../../../mst-types'
import { clamp } from '../../../util'
import PluginManager from '../../../PluginManager'
import TrackType from '../../../pluggableElementTypes/TrackType'

import LinearGenomeViewConfigSchema from './configSchema'

import BaseTrack from './baseTrack'
import calculateStaticBlocks from '../util/calculateStaticBlocks'
import calculateDynamicBlocks from '../util/calculateDynamicBlocks'
import RpcManager from '../../../rpc/RpcManager'

const validBpPerPx = [
  1 / 50,
  1 / 20,
  1 / 10,
  1 / 5,
  1 / 2,
  1,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
  500,
  1000,
  2000,
  5000,
  10000,
  20000,
  50000,
  100000,
  200000,
  500000,
]

function constrainBpPerPx(newBpPerPx) {
  // find the closest valid zoom level and return it
  // might consider reimplementing this later using a more efficient algorithm
  return validBpPerPx.sort(
    (a, b) => Math.abs(a - newBpPerPx) - Math.abs(b - newBpPerPx),
  )[0]
}

export default function LinearGenomeViewStateFactory(pluginManager) {
  return types
    .model('LinearGenomeView', {
      id: ElementId,
      type: types.literal('LinearGenomeView'),
      offsetPx: 0,
      bpPerPx: 1,
      flipped: false,
      // we use an array for the tracks because the tracks are displayed in a specific
      // order that we need to keep.
      tracks: types.array(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),
      controlsWidth: 120,
      width: 800,
      displayedRegionsOverrides: types.array(Region),
      configuration: LinearGenomeViewConfigSchema,
      // set this to true to hide the close, config, and tracksel buttons
      hideControls: false,
    })
    .views(self => ({
      get viewingRegionWidth() {
        return self.width - self.controlsWidth
      },
      get maxBpPerPx() {
        const displayWidth = self.viewingRegionWidth
        let totalbp = 0
        self.displayedRegions.forEach(region => {
          totalbp += region.end - region.start
        })
        return constrainBpPerPx(totalbp / displayWidth)
      },
      get minBpPerPx() {
        return constrainBpPerPx(0)
      },

      get staticBlocks() {
        return calculateStaticBlocks(self, self.horizontallyFlipped)
      },

      get dynamicBlocks() {
        return calculateDynamicBlocks(self, self.horizontallyFlipped)
      },

      get horizontallyFlipped() {
        return getConf(self, 'reversed')
      },
      get displayedRegions() {
        if (self.displayedRegionsOverrides.length)
          return self.displayedRegionsOverrides
        return self.defaultDisplayedRegions
      },
    }))
    .volatile(() => ({
      defaultDisplayedRegions: [],
    }))
    .actions(self => ({
      afterAttach() {
        this.fetchDisplayedRegions()
      },

      fetchDisplayedRegions: flow(function* fetchProjects() {
        const rootModel = getRoot(self)
        const { workerManager, configuration: rootConfig } = rootModel
        const regions = []
        const assemblies = rootConfig.assemblies || new Map()
        for (const [assemblyName, assembly] of assemblies) {
          if (assembly.sequence.type === 'Sizes') {
            const sizes = readConfObject(assembly.sequence, 'sizes')
            Object.keys(sizes).forEach(refName =>
              regions.push({
                assemblyName,
                refName,
                start: 0,
                end: sizes[refName],
              }),
            )
          } else if (assembly.sequence.type === 'ReferenceSequence') {
            const adapterConfig = readConfObject(assembly.sequence, 'adapter')
            const rpcManager = new RpcManager(pluginManager, rootConfig.rpc, {
              WebWorkerRpcDriver: {
                workers: workerManager.getWorkerGroup('rpc'),
              },
            })
            try {
              regions.push(
                ...(yield rpcManager.call(
                  rootConfig.configId,
                  'getRegions',
                  {
                    sessionId: assemblyName,
                    adapterType: adapterConfig.type,
                    adapterConfig,
                    rootConfig: getSnapshot(rootConfig),
                    assemblyName,
                  },
                  { timeout: 1000000 },
                )),
              )
            } catch (error) {
              console.error('Failed to fetch sequence', error)
            }
          }
          self.defaultDisplayedRegions = regions
        }
      }),

      setWidth(newWidth) {
        self.width = newWidth
      },
      showTrack(configuration, initialSnapshot = {}) {
        const { type } = configuration
        if (!type) throw new Error('track configuration has no `type` listed')
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) throw new Error(`unknown track type ${type}`)
        const track = trackType.stateModel.create({
          ...initialSnapshot,
          name,
          type,
          configuration,
        })
        self.tracks.push(track)
      },

      hideTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const shownTracks = self.tracks.filter(
          t => t.configuration === configuration,
        )
        transaction(() => shownTracks.forEach(t => self.tracks.remove(t)))
        return shownTracks.length
      },

      closeView() {
        getParent(self, 2).removeView(self)
      },

      toggleTrack(configuration) {
        // if we have any tracks with that configuration, turn them off
        const hiddenCount = self.hideTrack(configuration)
        // if none had that configuration, turn one on
        if (!hiddenCount) self.showTrack(configuration)
      },

      displayRegions(regions) {
        self.displayedRegions = regions.map(r =>
          isStateTreeNode(r) ? r : Region.create(r),
        )
      },

      activateTrackSelector() {
        if (getType(self.configuration).name === 'AnonymousModel')
          throw new Error('this view should have a real configuration')
        const trackSelectorType = getConf(self, 'trackSelectorType')
        if (trackSelectorType === 'hierarchical') {
          const rootModel = getRoot(self)
          if (!rootModel.drawerWidgets.get('hierarchicalTrackSelector'))
            rootModel.addDrawerWidget(
              'HierarchicalTrackSelectorDrawerWidget',
              'hierarchicalTrackSelector',
              { view: self },
            )
          const selector = rootModel.drawerWidgets.get(
            'hierarchicalTrackSelector',
          )
          selector.setView(self)
          rootModel.showDrawerWidget(selector)
        } else {
          throw new Error(`invalid track selector type ${trackSelectorType}`)
        }
      },

      zoomTo(newBpPerPx) {
        let bpPerPx = clamp(newBpPerPx, self.minBpPerPx, self.maxBpPerPx)
        bpPerPx = constrainBpPerPx(newBpPerPx)
        if (bpPerPx === self.bpPerPx) return
        const oldBpPerPx = self.bpPerPx
        self.bpPerPx = bpPerPx

        // tweak the offset so that the center of the view remains at the same coordinate
        const viewWidth = self.viewingRegionWidth
        self.offsetPx = Math.round(
          ((self.offsetPx + viewWidth / 2) * oldBpPerPx) / bpPerPx -
            viewWidth / 2,
        )
      },

      /**
       *
       * @param {number} px px in the view area, return value is the displayed regions
       * @returns {Array} of the displayed region that it lands in
       */
      pxToBp(px) {
        const regions = self.displayedRegions
        const bp = (self.offsetPx + px) * self.bpPerPx + 1
        let bpSoFar = 0

        for (let index = 0; index < regions.length; index += 1) {
          const region = regions[index]
          if (region.end - region.start + bpSoFar > bp && bpSoFar <= bp) {
            return { ...region, offset: Math.round(bp - bpSoFar), index }
          }
          bpSoFar += region.end - region.start
        }
        return undefined
      },

      /**
       * offset is the base-pair-offset in the displayed region, index is the index of the
       * displayed region in the linear genome view
       *
       * @param {object} start object as {start, end, offset, index}
       * @param {object} end object as {start, end, offset, index}
       */
      moveTo(start, end) {
        // find locations in the modellist
        let bpSoFar = 0
        if (start.index === end.index) {
          bpSoFar += end.offset - start.offset
        } else {
          const s = self.displayedRegions[start.index]
          bpSoFar += s.end - start.offset
          if (end.index - start.index > 2) {
            for (let i = start.index + 1; i < end.index - 1; i += 1) {
              bpSoFar +=
                self.displayedRegions[i].end - self.displayedRegions[i].start
            }
          }
          bpSoFar += end.offset
        }
        let bpToStart = 0
        for (let i = 0; i < self.displayedRegions.length; i += 1) {
          const region = self.displayedRegions[i]
          if (start.index === i) {
            bpToStart += start.offset
            break
          } else {
            bpToStart += region.end - region.start
          }
        }
        self.bpPerPx = clamp(
          bpSoFar / self.width,
          self.minBpPerPx,
          self.maxBpPerPx,
        )
        self.offsetPx = bpToStart / self.bpPerPx
      },
      resizeTrack(trackId, distance) {
        const track = self.tracks.find(t => t.id === trackId)
        if (track) track.setHeight(track.height + distance)
      },

      horizontalScroll(distance) {
        const leftPadding = 10
        const rightPadding = 10
        const displayRegionsTotalPx = self.displayedRegions.reduce(
          (a, b) => a + (b.end - b.start) / self.bpPerPx,
          0,
        )
        const maxOffset = displayRegionsTotalPx - leftPadding
        const displayWidth = self.viewingRegionWidth
        const minOffset = -displayWidth + rightPadding
        self.offsetPx = clamp(self.offsetPx + distance, minOffset, maxOffset)
      },

      /**
       * scrolls the view to center on the given bp. if that is not in any
       * of the displayed regions, does nothing
       * @param {number} bp
       * @param {string} refName
       * @param {string} assemblyName
       */
      centerAt(/* bp, refName, assemblyName */) {
        /* TODO */
      },

      activateConfigurationUI() {
        getRoot(self).editConfiguration(self.configuration)
      },

      setNewView(bpPerPx, offsetPx) {
        self.bpPerPx = bpPerPx
        self.offsetPx = offsetPx
      },
    }))
}

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
const stubManager = new PluginManager()
stubManager.addTrackType(
  () =>
    new TrackType({
      name: 'Base',
      stateModel: BaseTrack,
      RenderingComponent: true,
    }),
)
stubManager.configure()
export const TestStub = LinearGenomeViewStateFactory(stubManager)
