import { transaction } from 'mobx'
import {
  getEnv,
  getRoot,
  isStateTreeNode,
  types,
  getType,
} from 'mobx-state-tree'
import React from 'react'
import {
  ConfigurationSchema,
  ConfigurationReference,
  getConf,
  readConfObject,
} from '../../../configuration'
import { ElementId, Region } from '../../../mst-types'
import { assembleLocString, clamp } from '../../../util'
import PluginManager from '../../../PluginManager'
import { TrackType } from '../../../Plugin'

import LinearGenomeViewConfigSchema from './configSchema'

export const BaseTrackConfig = ConfigurationSchema('BaseTrack', {
  viewType: 'LinearGenomeView',
  name: {
    description: 'descriptive name of the track',
    type: 'string',
    defaultValue: 'Track',
  },
  backgroundColor: {
    description: `the track's background color`,
    type: 'color',
    defaultValue: '#eee',
  },
  description: {
    description: 'a description of the track',
    type: 'string',
    defaultValue: '',
  },
  category: {
    description: 'the category and sub-categories of a track',
    type: 'stringArray',
    defaultValue: [],
  },
})

// these MST models only exist for tracks that are *shown*.
// they should contain only UI state for the track, and have
// a reference to a track configuration (stored under root.configuration.tracks).

// note that multiple displayed tracks could use the same configuration.
const minTrackHeight = 20
export const BaseTrack = types
  .model('BaseTrack', {
    id: ElementId,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      minTrackHeight,
    ),
    subtracks: types.literal(undefined),
    configuration: ConfigurationReference(BaseTrackConfig),
  })
  .views(self => ({
    get RenderingComponent() {
      return (
        self.reactComponent ||
        (() => (
          <div className="TrackRenderingNotImplemented">
            Rendering not implemented for {self.type} tracks
          </div>
        ))
      )
    },
  }))
  .actions(self => ({
    setHeight(trackHeight) {
      if (trackHeight >= minTrackHeight) self.height = trackHeight
    },
  }))

const ViewStateBase = types.model({
  // views have an auto-generated ID by default
  id: ElementId,
})

export default function LinearGenomeViewStateFactory(pluginManager) {
  return types
    .compose(
      'LinearGenomeView',
      ViewStateBase,
      types.model({
        id: ElementId,
        type: types.literal('LinearGenomeView'),
        offsetPx: 0,
        bpPerPx: 1,
        // we use an array for the tracks because the tracks are displayed in a specific
        // order that we need to keep.
        tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        ),
        controlsWidth: 100,
        displayedRegions: types.array(Region),
        configuration: ConfigurationReference(LinearGenomeViewConfigSchema),
      }),
    )
    .views(self => ({
      get width() {
        return getEnv(self).testEnv ? 800 : getRoot(self).viewsWidth
      },
      get totalBlocksWidthPx() {
        return self.blocks.reduce((a, b) => a + b.widthPx, 0)
      },

      /**
       * calculate the blocks we should be showing
       */
      get blocks() {
        const windowLeftBp = self.offsetPx * self.bpPerPx
        const windowRightBp = (self.offsetPx + self.width) * self.bpPerPx
        const blockSizePx = Math.ceil(self.width / 200) * 200
        const blockSizeBp = blockSizePx * self.bpPerPx
        // for each displayed region
        let regionBpOffset = 0
        const blocks = []
        self.displayedRegions.forEach(region => {
          // find the block numbers of the left and right window sides,
          // clamp those to the region range, and then make blocks for that range
          const regionBlockCount = Math.ceil(
            (region.end - region.start) / blockSizeBp,
          )

          let windowRightBlockNum = Math.floor(
            (windowRightBp - regionBpOffset) / blockSizeBp,
          )
          if (windowRightBlockNum >= regionBlockCount)
            windowRightBlockNum = regionBlockCount - 1
          // if (windowRightBlockNum < 0) return // this region is not visible

          let windowLeftBlockNum = Math.floor(
            (windowLeftBp - regionBpOffset) / blockSizeBp,
          )
          if (windowLeftBlockNum < 0) windowLeftBlockNum = 0
          // if (windowLeftBlockNum >= regionBlockCount) return // this region is not visible

          for (
            let blockNum = windowLeftBlockNum;
            blockNum <= windowRightBlockNum;
            blockNum += 1
          ) {
            const newBlock = {
              assembly: region.assembly,
              refName: region.refName,
              start: region.start + blockNum * blockSizeBp,
              end: Math.min(
                region.end,
                region.start + (blockNum + 1) * blockSizeBp,
              ),
              offsetPx:
                (regionBpOffset + region.start + blockNum * blockSizeBp) /
                self.bpPerPx,
            }
            newBlock.key = assembleLocString(newBlock)
            newBlock.widthPx =
              Math.abs(newBlock.end - newBlock.start) / self.bpPerPx
            blocks.push(newBlock)
          }

          regionBpOffset += region.end - region.start
        })

        return blocks
      },
    }))
    .actions(self => ({
      showTrack(configuration, initialSnapshot = {}) {
        const { type } = configuration
        const name = readConfObject(configuration, 'name')
        const trackType = pluginManager.getTrackType(type)
        if (!trackType) throw new Error(`unknown track type ${type}`)
        const track = trackType.stateModel.create(
          Object.assign({}, initialSnapshot, { name, type, configuration }),
        )
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
        if (getType(self.configuration).name === 'AnonymousModel') debugger
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
        self.bpPerPx = newBpPerPx
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
        const displayWidth = self.width - self.controlsWidth
        const minOffset = -displayWidth + rightPadding
        self.offsetPx = clamp(self.offsetPx + distance, minOffset, maxOffset)
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
