import type { Region, ViewSnap } from './index.ts'

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
      for (let i = start.index + 1, l = end.index; i < l; i++) {
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
  for (let i = start.index, l = end.index; i < l; i++) {
    const r = displayedRegions[i]!
    if ((r.end - r.start) / bpPerPx > minimumBlockWidth) {
      numBlocksWideEnough++
    }
  }

  const targetBpPerPx =
    len / (width - interRegionPaddingWidth * numBlocksWideEnough)
  const newBpPerPx = self.zoomTo(targetBpPerPx)

  let extraBp = 0
  if (targetBpPerPx < newBpPerPx) {
    extraBp = ((newBpPerPx - targetBpPerPx) * self.width) / 2
  }

  let bpToStart = -extraBp
  let paddingPx = 0
  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const region = displayedRegions[i]!
    if (start.index === i) {
      bpToStart += start.offset
      break
    }
    bpToStart += region.end - region.start
    const regionWidthPx = (region.end - region.start) / newBpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      paddingPx += interRegionPaddingWidth
    }
  }

  const scrollPos = Math.round(bpToStart / newBpPerPx + paddingPx)
  self.scrollTo(scrollPos)
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
    minimumBlockWidth,
  } = self
  const bp = (offsetPx + px) * bpPerPx
  if (bp < 0) {
    const r = displayedRegions[0]!
    const snap = r
    return {
      ...(snap as Omit<typeof snap, symbol>),
      oob: true,
      coord: coord(r, bp),
      offset: bp,
      index: 0,
    }
  }

  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (len + bpSoFar > bp && bpSoFar <= bp) {
      const snap = r
      return {
        ...(snap as Omit<typeof snap, symbol>),
        oob: false,
        offset,
        coord: coord(r, offset),
        index: i,
      }
    }

    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      const paddingStart = bpSoFar + len
      const paddingEnd = paddingStart + interRegionPaddingBp
      if (bp >= paddingStart && bp < paddingEnd) {
        const nextR = displayedRegions[i + 1]!
        const snap = nextR
        return {
          ...(snap as Omit<typeof snap, symbol>),
          oob: false,
          offset: 0,
          coord: coord(nextR, 0),
          index: i + 1,
        }
      }
      bpSoFar += len + interRegionPaddingBp
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
      // xref for Omit https://github.com/mobxjs/mobx-state-tree/issues/1524
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

  const {
    interRegionPaddingWidth,
    bpPerPx,
    displayedRegions,
    minimumBlockWidth,
  } = self
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx

  let i = 0
  for (let l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber !== undefined ? regionNumber === i : true)
    ) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
    }

    bpSoFar += len
    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      bpSoFar += interRegionPaddingBp
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
