import {
  getEnv,
  getRoot,
  isStateTreeNode,
  types,
  isIdentifierType,
} from 'mobx-state-tree'
import React from 'react'
import {
  ConfigurationSchema,
  ConfigurationReference,
  getConf,
  readConfObject,
} from '../../../configuration'
import { ElementId, Region } from '../../../mst-types'
import { assembleLocString } from '../../../util'

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

const minTrackHeight = 20
export const BaseTrack = types
  .model('BaseTrack', {
    id: ElementId,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      minTrackHeight,
    ),
    visible: types.optional(types.boolean, true),
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

    show() {
      self.visible = true
    },

    hide() {
      self.visible = false
    },

    toggle() {
      if (self.visible) this.hide()
      else this.show()
    },
  }))

const ViewStateBase = types.model({
  // views have an auto-generated ID by default
  id: ElementId,
})

export default function LinearGenomeViewStateFactory(trackTypes) {
  return types
    .compose(
      'LinearGenomeView',
      ViewStateBase,
      types.model({
        id: ElementId,
        type: types.literal('LinearGenomeView'),
        offsetPx: 0,
        bpPerPx: 1,
        tracks: types.map(types.union(...trackTypes)),
        controlsWidth: 100,
        displayedRegions: types.array(Region),
        configuration: ConfigurationSchema('LinearGenomeView', {
          backgroundColor: { type: 'color', defaultValue: '#eee' },
          trackSelectorType: {
            type: 'string',
            defaultValue: 'hierarchical',
          },
        }),
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
                (regionBpOffset + region.start + blockNum * blockSizeBp) *
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
      showTrack(configuration) {
        const { type } = configuration
        const name = readConfObject(configuration, 'name')
        const TrackType = trackTypes.find(t => t.name === type)
        if (!TrackType) throw new Error(`unknown track type ${type}`)
        const track = TrackType.create({ name, type, configuration })
        self.tracks.set(track.id, track)
      },

      hideTrack(configuration) {
        // TODO
      },

      toggleTrack(configuration) {
        // TODO
        // if we have any tracks with that configuration, turn them off
        // otherwise, turn on a track with that configuration
      },

      displayRegions(regions) {
        self.displayedRegions = regions.map(r =>
          isStateTreeNode(r) ? r : Region.create(r),
        )
      },

      activateTrackSelector() {
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

      resizeTrack(trackId, distance) {
        const track = self.tracks.get(trackId)
        track.setHeight(track.height + distance)
      },

      horizontalScroll(distance) {
        const leftPadding = 10
        const rightPadding = 10
        const displayRegionsTotalPx = self.displayedRegions.reduce(
          (a, b) => a + (b.end - b.start) / self.bpPerPx,
          0,
        )
        self.offsetPx = Math.min(
          Math.max(self.offsetPx + distance, -leftPadding),
          displayRegionsTotalPx -
            (self.width - self.controlsWidth) +
            rightPadding,
        )
      },
    }))
}

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
export const TestStub = LinearGenomeViewStateFactory([BaseTrack])
