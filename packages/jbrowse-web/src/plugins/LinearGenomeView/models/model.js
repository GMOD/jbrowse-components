import React from 'react'
import { types, isStateTreeNode } from 'mobx-state-tree'
import { ConfigurationSchema } from '../../../configuration'
import { ElementId, Region } from '../../../mst-types'
import { assembleLocString } from '../../../util'

const minTrackHeight = 20
export const BaseTrack = types
  .model('BaseTrack', {
    id: ElementId,
    name: types.string,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      minTrackHeight,
    ),
    subtracks: types.literal(undefined),
    configuration: ConfigurationSchema('BaseTrack', {
      backgroundColor: {
        description: `the track's background color`,
        type: 'color',
        defaultValue: '#eee',
      },
    }),
  })
  .views(self => ({
    get RenderingComponent() {
      return () => (
        <div className="TrackRenderingNotImplemented">
          Rendering not implemented for {self.type} tracks
        </div>
      )
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
        type: types.literal('LinearGenomeView'),
        offsetPx: 0,
        bpPerPx: 1,
        tracks: types.array(types.union(...trackTypes)),
        controlsWidth: 100,
        displayedRegions: types.array(Region),
        width: 800,
        configuration: ConfigurationSchema('LinearGenomeView', {
          backgroundColor: { type: 'color', defaultValue: '#eee' },
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
      showTrack(id, name, type) {
        const TrackType = trackTypes.find(t => t.name === type)
        if (!TrackType) throw new Error(`unknown track type ${type}`)
        self.tracks.push(TrackType.create({ id, name, type }))
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
            // TODO: be more precise about what kind of errors to ignore here
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
}

// a stub linear genome view state model that only accepts base track types.
// used in unit tests.
export const TestStub = LinearGenomeViewStateFactory([BaseTrack])
