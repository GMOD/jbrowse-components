export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

type RegionSnap = {
  start: number
  end: number
  refName: string
  reversed?: boolean
  assemblyName: string
}

type MoveSnap = {
  displayedRegions: { start: number; end: number }[]
  bpPerPx: number
  width: number
  minimumBlockWidth: number
  interRegionPaddingWidth: number
}

type ViewLayout = {
  displayedRegions: RegionSnap[]
  bpPerPx: number
  offsetPx: number
  width: number
  minimumBlockWidth: number
  interRegionPaddingWidth: number
}

function lengthBetween(
  self: { displayedRegions: { start: number; end: number }[] },
  start: BpOffset,
  end: BpOffset,
) {
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

function computeTargetBpPerPx(self: MoveSnap, start: BpOffset, end: BpOffset) {
  const { width, interRegionPaddingWidth, displayedRegions, bpPerPx, minimumBlockWidth } = self
  const len = lengthBetween(self, start, end)
  let numBlocksWideEnough = 0
  for (let i = start.index, l = end.index; i < l; i++) {
    const r = displayedRegions[i]!
    if ((r.end - r.start) / bpPerPx >= minimumBlockWidth) {
      numBlocksWideEnough++
    }
  }
  return len / (width - interRegionPaddingWidth * numBlocksWideEnough)
}

function computeScrollPos(
  self: MoveSnap,
  start: BpOffset,
  bpPerPx: number,
  extraBp: number,
) {
  const { displayedRegions, minimumBlockWidth, interRegionPaddingWidth } = self
  let bpToStart = -extraBp
  let paddingPx = 0
  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const region = displayedRegions[i]!
    if (start.index === i) {
      bpToStart += start.offset
      break
    }
    bpToStart += region.end - region.start
    if ((region.end - region.start) / bpPerPx >= minimumBlockWidth && i < l - 1) {
      paddingPx += interRegionPaddingWidth
    }
  }
  return Math.round(bpToStart / bpPerPx + paddingPx)
}

export function moveTo(
  self: MoveSnap & {
    zoomTo: (arg: number) => number
    scrollTo: (arg: number) => void
  },
  start?: BpOffset,
  end?: BpOffset,
) {
  if (!start || !end) {
    return
  }
  const targetBpPerPx = computeTargetBpPerPx(self, start, end)
  const newBpPerPx = self.zoomTo(targetBpPerPx)
  const extraBp =
    targetBpPerPx < newBpPerPx
      ? ((newBpPerPx - targetBpPerPx) * self.width) / 2
      : 0
  self.scrollTo(computeScrollPos(self, start, newBpPerPx, extraBp))
}

/**
 * Pure version of moveTo: returns the {bpPerPx, offsetPx} that moveTo would
 * apply, without mutating any model. Assumes no bpPerPx clamping (i.e.
 * Base1DView with no min/maxBpPerPx).
 */
export function computeMoveToLayout(
  self: MoveSnap,
  start: BpOffset,
  end: BpOffset,
): { bpPerPx: number; offsetPx: number } {
  const bpPerPx = computeTargetBpPerPx(self, start, end)
  return { bpPerPx, offsetPx: computeScrollPos(self, start, bpPerPx, 0) }
}

function coord(r: RegionSnap, bp: number) {
  return Math.floor(r.reversed ? r.end - bp : r.start + bp) + 1
}

// manual return type since getSnapshot hard to infer here
export function pxToBp(
  self: ViewLayout,
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
    return { ...r, oob: true, coord: coord(r, bp), offset: bp, index: 0 }
  }

  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (len + bpSoFar > bp && bpSoFar <= bp) {
      return { ...r, oob: false, offset, coord: coord(r, offset), index: i }
    }

    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      const paddingStart = bpSoFar + len
      const paddingEnd = paddingStart + interRegionPaddingBp
      if (bp >= paddingStart && bp < paddingEnd) {
        const nextR = displayedRegions[i + 1]!
        return { ...nextR, oob: false, offset: 0, coord: coord(nextR, 0), index: i + 1 }
      }
      bpSoFar += len + interRegionPaddingBp
    } else {
      bpSoFar += len
    }
  }

  if (bp >= bpSoFar && displayedRegions.length > 0) {
    const r = displayedRegions.at(-1)!
    const offset = bp - bpSoFar + r.end - r.start
    return { ...r, oob: true, offset, coord: coord(r, offset), index: displayedRegions.length - 1 }
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
  displayedRegionIndex,
  self,
}: {
  refName: string
  coord: number
  displayedRegionIndex?: number
  self: ViewLayout
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
      (displayedRegionIndex !== undefined ? displayedRegionIndex === i : true)
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
