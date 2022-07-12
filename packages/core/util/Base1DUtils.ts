import { getSnapshot } from 'mobx-state-tree'
import { ViewSnap } from './index'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

function lengthBetween(self: any, start: BpOffset, end: BpOffset) {
  let bpSoFar = 0

  const interRegionPaddingBp = self.interRegionPaddingWidth * self.bpPerPx

  if (start.index === end.index) {
    bpSoFar += end.offset - start.offset
  } else {
    const s = self.displayedRegions[start.index]
    bpSoFar += s.end - s.start - start.offset
    if (end.index - start.index >= 2) {
      for (let i = start.index + 1; i < end.index; i++) {
        const region = self.displayedRegions[i]
        const len = region.end - region.start
        bpSoFar += len + interRegionPaddingBp
      }
    }
    bpSoFar += end.offset
  }
  return bpSoFar
}

export function moveTo(self: any, start?: BpOffset, end?: BpOffset) {
  if (!start || !end) {
    return
  }
  const { width, interRegionPaddingWidth } = self

  const len = lengthBetween(self, start, end)
  const numBlocks = end.index - start.index
  const targetBpPerPx = len / (width - interRegionPaddingWidth * numBlocks)
  const newBpPerPx = self.zoomTo(targetBpPerPx)

  // If our target bpPerPx was smaller than the allowed minBpPerPx, adjust
  // the scroll so the requested range is in the middle of the screen
  let extraBp = 0
  if (targetBpPerPx < newBpPerPx) {
    extraBp = ((newBpPerPx - targetBpPerPx) * self.width) / 2
  }

  let bpToStart = -extraBp

  for (let i = 0; i < self.displayedRegions.length; i += 1) {
    const region = self.displayedRegions[i]
    if (start.index === i) {
      bpToStart += start.offset
      break
    } else {
      bpToStart += region.end - region.start
    }
  }

  self.scrollTo(Math.round(bpToStart / self.bpPerPx))
}

export function pxToBp(self: any, px: number) {
  let bpSoFar = 0
  const {
    bpPerPx,
    offsetPx,
    displayedRegions,
    interRegionPaddingWidth,
    staticBlocks,
  } = self
  const blocks = staticBlocks.contentBlocks
  const bp = (offsetPx + px) * bpPerPx
  if (bp < 0) {
    const region = displayedRegions[0]
    const snap = getSnapshot(region)
    return {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      ...(snap as Omit<typeof snap, symbol>),
      oob: true,
      coord: region.reversed
        ? Math.floor(region.end - bp) + 1
        : Math.floor(region.start + bp) + 1,
      offset: bp,
      index: 0,
    }
  }

  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  let currBlock = 0
  for (let i = 0; i < displayedRegions.length; i++) {
    const region = displayedRegions[i]
    const len = region.end - region.start
    const offset = bp - bpSoFar
    if (len + bpSoFar > bp && bpSoFar <= bp) {
      const snap = getSnapshot(region)
      return {
        // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
        ...(snap as Omit<typeof snap, symbol>),
        oob: false,
        offset,
        coord: region.reversed
          ? Math.floor(region.end - offset) + 1
          : Math.floor(region.start + offset) + 1,
        index: i,
      }
    }

    // add the interRegionPaddingWidth if the boundary is in the screen e.g. in
    // a static block
    if (blocks[currBlock]?.regionNumber === i) {
      bpSoFar += len + interRegionPaddingBp
      currBlock++
    } else {
      bpSoFar += len
    }
  }

  if (bp >= bpSoFar) {
    const region = displayedRegions[displayedRegions.length - 1]
    const len = region.end - region.start
    const offset = bp - bpSoFar + len
    const snap = getSnapshot(region)
    return {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      ...(snap as Omit<typeof snap, symbol>),
      oob: true,
      offset,
      coord: region.reversed
        ? Math.floor(region.end - offset) + 1
        : Math.floor(region.start + offset) + 1,
      index: displayedRegions.length - 1,
    }
  }
  return {
    coord: 0,
    index: 0,
    refName: '',
    oob: true,
    assemblyName: '',
    offset: 0,
    start: 0,
    end: 0,
    reversed: false,
  }
}

export function bpToPx({
  refName,
  coord,
  regionNumber,
  self,
}: {
  refName: string
  coord: number
  regionNumber?: number
  self: ViewSnap
}) {
  let bpSoFar = 0

  const {
    interRegionPaddingWidth,
    bpPerPx,
    displayedRegions,
    staticBlocks: { blocks },
  } = self
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  let firstBlock = true
  let currStaticBlock = blocks[0]?.regionNumber

  const index = displayedRegions.findIndex((region, idx) => {
    const len = region.end - region.start
    if (
      refName === region.refName &&
      coord >= region.start &&
      coord <= region.end
    ) {
      if (regionNumber ? regionNumber === idx : true) {
        bpSoFar += region.reversed ? region.end - coord : coord - region.start
        return true
      }
    }

    // add the interRegionPaddingWidth if the boundary is in the screen e.g. in
    // a static block
    if (currStaticBlock === idx) {
      bpSoFar += len + (firstBlock ? 0 : interRegionPaddingBp)
      currStaticBlock++
      firstBlock = false
    } else {
      bpSoFar += len
    }
    return false
  })
  const found = displayedRegions[index]
  if (found) {
    return {
      index,
      offsetPx: Math.round(bpSoFar / bpPerPx),
    }
  }

  return undefined
}
