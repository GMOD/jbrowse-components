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

// total bp from the start of displayedRegions through regionIndex + regionOffset,
// counting inter-region padding as bp
function cumulativeBp(
  self: MoveSnap,
  regionIndex: number,
  regionOffset: number,
  bpPerPx: number,
) {
  const { displayedRegions, minimumBlockWidth, interRegionPaddingWidth } = self
  const paddingBp = interRegionPaddingWidth * bpPerPx
  let bpSoFar = regionOffset
  for (let i = 0; i < regionIndex; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    bpSoFar += len
    if (len / bpPerPx >= minimumBlockWidth && i < displayedRegions.length - 1) {
      bpSoFar += paddingBp
    }
  }
  return bpSoFar
}

function lengthBetween(
  displayedRegions: { start: number; end: number }[],
  start: BpOffset,
  end: BpOffset,
) {
  let bpSoFar = 0
  if (start.index === end.index) {
    bpSoFar = end.offset - start.offset
  } else {
    const s = displayedRegions[start.index]!
    bpSoFar = s.end - s.start - start.offset
    for (let i = start.index + 1; i < end.index; i++) {
      const r = displayedRegions[i]!
      bpSoFar += r.end - r.start
    }
    bpSoFar += end.offset
  }
  return bpSoFar
}

function computeTargetBpPerPx(self: MoveSnap, start: BpOffset, end: BpOffset) {
  const { width, interRegionPaddingWidth, displayedRegions, bpPerPx, minimumBlockWidth } = self
  const len = lengthBetween(displayedRegions, start, end)
  let numBlocksWideEnough = 0
  for (let i = start.index; i < end.index; i++) {
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
  return Math.round((cumulativeBp(self, start.index, start.offset, bpPerPx) - extraBp) / bpPerPx)
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

function regionCoord(r: RegionSnap, bp: number) {
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
  const { bpPerPx, offsetPx, displayedRegions, interRegionPaddingWidth, minimumBlockWidth } = self
  const bp = (offsetPx + px) * bpPerPx
  if (bp < 0) {
    const r = displayedRegions[0]!
    return { ...r, oob: true, coord: regionCoord(r, bp), offset: bp, index: 0 }
  }

  const paddingBp = interRegionPaddingWidth * bpPerPx
  let bpSoFar = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (offset >= 0 && offset < len) {
      return { ...r, oob: false, offset, coord: regionCoord(r, offset), index: i }
    }
    if (len / bpPerPx >= minimumBlockWidth && i < l - 1) {
      const paddingStart = bpSoFar + len
      if (bp >= paddingStart && bp < paddingStart + paddingBp) {
        const nextR = displayedRegions[i + 1]!
        return { ...nextR, oob: false, offset: 0, coord: regionCoord(nextR, 0), index: i + 1 }
      }
      bpSoFar += len + paddingBp
    } else {
      bpSoFar += len
    }
  }

  const r = displayedRegions.at(-1)
  if (!r) {
    throw new Error('pxToBp called with empty displayedRegions')
  }
  const offset = bp - bpSoFar + r.end - r.start
  return { ...r, oob: true, offset, coord: regionCoord(r, offset), index: displayedRegions.length - 1 }
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
  const { bpPerPx, displayedRegions } = self

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (displayedRegionIndex === undefined || displayedRegionIndex === i)
    ) {
      const regionOffset = r.reversed ? r.end - coord : coord - r.start
      return {
        index: i,
        offsetPx: Math.round(cumulativeBp(self, i, regionOffset, bpPerPx) / bpPerPx),
      }
    }
  }
  return undefined
}
