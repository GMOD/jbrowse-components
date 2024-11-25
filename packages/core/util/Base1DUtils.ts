import type { Region, ViewSnap } from './index'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

function lengthBetween(self: ViewSnap, start: BpOffset, end: BpOffset) {
  let bpSoFar = 0
  const { displayedRegions } = self
  if (start.index === end.index) {
    bpSoFar += end.offset - start.offset
  } else {
    const s = displayedRegions[start.index]!
    bpSoFar += s.end - s.start - start.offset
    if (end.index - start.index >= 2) {
      for (let i = start.index + 1; i < end.index; i++) {
        const region = displayedRegions[i]!
        const len = region.end - region.start
        bpSoFar += len
      }
    }
    bpSoFar += end.offset
  }
  return bpSoFar
}

export function moveTo(
  self: ViewSnap & {
    zoomTo: (arg: number) => number
    scrollTo: (arg: number) => void
  },
  start?: BpOffset,
  end?: BpOffset,
) {
  if (!start || !end) {
    return
  }
  const {
    width,
    interRegionPaddingWidth,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth,
  } = self

  const len = lengthBetween(self, start, end)
  let numBlocksWideEnough = 0
  for (let i = start.index; i < end.index; i++) {
    const r = displayedRegions[i]!
    if ((r.end - r.start) / bpPerPx > minimumBlockWidth) {
      numBlocksWideEnough++
    }
  }

  const targetBpPerPx =
    len / (width - interRegionPaddingWidth * numBlocksWideEnough)
  const newBpPerPx = self.zoomTo(targetBpPerPx)

  // If our target bpPerPx was smaller than the allowed minBpPerPx, adjust
  // the scroll so the requested range is in the middle of the screen
  let extraBp = 0
  if (targetBpPerPx < newBpPerPx) {
    extraBp = ((newBpPerPx - targetBpPerPx) * self.width) / 2
  }

  let bpToStart = -extraBp

  for (let i = 0; i < self.displayedRegions.length; i += 1) {
    const region = self.displayedRegions[i]!
    if (start.index === i) {
      bpToStart += start.offset
      break
    } else {
      bpToStart += region.end - region.start
    }
  }

  self.scrollTo(Math.round(bpToStart / self.bpPerPx))
}

function coord(r: Region, bp: number) {
  return Math.floor(r.reversed ? r.end - bp : r.start + bp) + 1
}

// manual return type since getSnapshot hard to infer here
export function pxToBp(
  self: ViewSnap,
  px: number,
): {
  coord: number
  index: number
  refName: string
  oob: boolean
  assemblyName: string
  offset: number
  start: number
  end: number
  reversed?: boolean
} {
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
    const r = displayedRegions[0]!
    const snap = r
    return {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      ...(snap as Omit<typeof snap, symbol>),
      oob: true,
      coord: coord(r, bp),
      offset: bp,
      index: 0,
    }
  }

  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  let currBlock = 0
  for (let i = 0; i < displayedRegions.length; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (len + bpSoFar > bp && bpSoFar <= bp) {
      const snap = r
      return {
        // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
        ...(snap as Omit<typeof snap, symbol>),
        oob: false,
        offset,
        coord: coord(r, offset),
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

  if (bp >= bpSoFar && displayedRegions.length > 0) {
    const r = displayedRegions.at(-1)!
    const len = r.end - r.start
    const offset = bp - bpSoFar + len

    const snap = r
    return {
      // xref https://github.com/mobxjs/mobx-state-tree/issues/1524 for Omit
      ...(snap as Omit<typeof snap, symbol>),
      oob: true,
      offset,
      coord: coord(r, offset),
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

  const { interRegionPaddingWidth, bpPerPx, displayedRegions, staticBlocks } =
    self
  const blocks = staticBlocks.contentBlocks
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  let currBlock = 0

  let i = 0
  for (; i < displayedRegions.length; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber ? regionNumber === i : true)
    ) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
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
  const found = displayedRegions[i]
  if (found) {
    return {
      index: i,
      offsetPx: Math.round(bpSoFar / bpPerPx),
    }
  }

  return undefined
}

export function bpToPxMap({
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

  const { interRegionPaddingWidth, bpPerPx, displayedRegions, staticBlocks } =
    self
  const blocks = staticBlocks.contentBlocks
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  const map = {}
  let currBlock = 0

  let i = 0
  for (; i < displayedRegions.length; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber === undefined ? true : regionNumber === i)
    ) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
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
  const found = displayedRegions[i]
  if (found) {
    return {
      index: i,
      offsetPx: Math.round(bpSoFar / bpPerPx),
    }
  }

  return map
}
