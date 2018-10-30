import shortid from 'shortid'
import React from 'react'
import { types, getParent, getSnapshot } from 'mobx-state-tree'

const IdType = types.optional(types.string, shortid.generate)

export const Block = types
  .model({
    refName: types.string,
    start: types.number,
    end: types.number,
  })
  .views(self => ({
    get widthPx() {
      return Math.abs(self.end - self.start) / getParent(self, 2).bpPerPx
    },
  }))

const minTrackHeight = 20
export const Track = types
  .model('Track', {
    id: IdType,
    name: types.string,
    type: types.string,
    height: types.optional(
      types.refinement('trackHeight', types.number, n => n >= minTrackHeight),
      minTrackHeight,
    ),
    subtracks: types.maybe(types.array(types.late(() => Track))),
  })
  .views(self => ({
    get configuration() {
      const snap = Object.assign({}, getSnapshot(self))
      delete snap.blocks
      delete snap.id
      return snap
    },
  }))

const ViewStateBase = types.model({
  // views have an auto-generated ID by default
  id: IdType,
})

const LinearGenomeViewState = types
  .compose(
    ViewStateBase,
    types.model({
      type: types.literal('linear'),
      offsetPx: 0,
      bpPerPx: 1,
      blocks: types.array(Block),
      tracks: types.array(Track),
      controlsWidth: 100,
      width: 800,
    }),
  )
  .views(self => ({
    get totalBlocksWidthPx() {
      return self.blocks.reduce((a, b) => a + b.widthPx, 0)
    },
    get configuration() {
      const snap = Object.assign({}, getSnapshot(self))
      delete snap.blocks
      delete snap.id
      return snap
    },
  }))
  .actions(self => ({
    addTrack(id, name, type) {
      self.tracks.push(Track.create({ id, name, type }))
    },

    pushBlock(refName, start, end) {
      self.blocks.push(Block.create({ refName, start, end }))
    },

    horizontalScroll(distance) {
      self.offsetPx = Math.min(
        Math.max(self.offsetPx + distance, 0),
        self.width - self.totalBlocksWidthPx - self.controlsWidth,
      )
    },
  }))

export default LinearGenomeViewState
