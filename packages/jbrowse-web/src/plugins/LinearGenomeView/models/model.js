import { types, getParent, isStateTreeNode } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../../configuration'
import { IdType, Region } from '../../../types'

// a Block is just a Region that knows its parent's zoomlevel
export const Block = types
  .compose(
    Region,
    types.model({
      bpPerPx: types.number,
    }),
  )
  .views(self => ({
    get widthPx() {
      return Math.abs(self.end - self.start) / self.bpPerPx
    },
  }))

const minTrackHeight = 20
export const Track = types.model('Track', {
  id: IdType,
  name: types.string,
  type: types.string,
  height: types.optional(
    types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
    minTrackHeight,
  ),
  subtracks: types.maybe(types.array(types.late(() => Track))),
  configuration: ConfigurationSchema('Track', {
    backgroundColor: {
      description: `the track's background color`,
      type: 'color',
      defaultValue: '#eee',
    },
  }),
})

const ViewStateBase = types.model({
  // views have an auto-generated ID by default
  id: IdType,
})

const LinearGenomeViewState = types
  .compose(
    'LinearViewModel',
    ViewStateBase,
    types.model({
      type: types.literal('linear'),
      offsetPx: 0,
      bpPerPx: 1,
      tracks: types.array(Track),
      controlsWidth: 100,
      displayedRegions: types.array(Region),
      width: 800,
      configuration: ConfigurationSchema('LinearView', {
        bar: { type: 'integer', defaultValue: 0 },
      }),
    }),
  )
  .views(self => ({
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
            ref: region.ref,
            start: region.start + blockNum * blockSizeBp,
            end: Math.min(
              region.end,
              region.start + (blockNum + 1) * blockSizeBp,
            ),
            offsetPx:
              (regionBpOffset + region.start + blockNum * blockSizeBp) *
              self.bpPerPx,
          }
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
    showTrack(id, name, type) {
      self.tracks.push(Track.create({ id, name, type }))
    },

    displayRegions(regions) {
      self.displayedRegions = regions.map(
        r => (isStateTreeNode(r) ? r : Region.create(r)),
      )
    },

    resizeTrack(trackId, distance) {
      const track = self.tracks.find(t => t.id === trackId)
      if (track) {
        try {
          track.height += distance
        } catch (e) {
          /* ignore */
        }
      }
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

export default LinearGenomeViewState
