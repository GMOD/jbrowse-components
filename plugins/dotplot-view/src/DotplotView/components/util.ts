import {
  getTickDisplayStr,
  max,
  measureText,
  toLocale,
} from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { Dotplot1DViewModel } from '../model.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface Tick {
  type: string
  base: number
  index: number
  refName: string
}

export interface PositionedTick {
  tick: Tick
  alongPx: number
}

export function locstr(
  px: number,
  view: Dotplot1DViewModel,
  includeAsm = true,
) {
  const { assemblyName, refName, start, offset, oob } = view.pxToBp(px)
  const coord = Math.floor(start + offset)
  return oob
    ? 'out of bounds'
    : `${includeAsm ? `{${assemblyName}}` : ''}${refName}:${toLocale(coord)}`
}

// Bundling blocks + bpPerPx + hide as one axis prevents the H/V mix-up that
// used to produce wrong border sizing — the three values must come from the
// same view (`bpPerPx` drives the tick-label precision string).
export interface AxisBundle {
  blocks: ContentBlock[]
  bpPerPx: number
  hide: Set<string>
}

function stringLenPx(a: string) {
  return measureText(a.slice(0, 30))
}

// Maps each tick's (refName, base) to an `alongPx` offset within the view —
// negative or out-of-range positions are kept so the caller can clip in one
// place. Shared between HorizontalAxis and VerticalAxis to keep their tick
// math identical.
export function computeTickPositions(
  view: Dotplot1DViewModel,
  ticks: Tick[],
): PositionedTick[] {
  const snap = {
    ...getSnapshot(view),
    width: view.width,
    staticBlocks: view.staticBlocks,
  }
  const offsetPx = view.offsetPx
  return ticks.flatMap(tick => {
    const px = bpToPx({
      refName: tick.refName,
      coord: tick.base,
      self: snap,
    })?.offsetPx
    return px === undefined ? [] : [{ tick, alongPx: px - offsetPx }]
  })
}

export function pxWidthForBlocks({ blocks, bpPerPx, hide }: AxisBundle) {
  const widths: number[] = []
  for (const b of blocks) {
    if (!hide.has(b.key)) {
      widths.push(
        stringLenPx(b.refName),
        stringLenPx(getTickDisplayStr(b.end, bpPerPx)),
      )
    }
  }
  return max(widths)
}

export function getBlockLabelKeysToHide(
  blocks: ContentBlock[],
  length: number,
  viewOffsetPx: number,
) {
  const blockLabelKeysToHide = new Set<string>()
  const sortedBlocks = [...blocks].sort((a, b) => {
    const alen = a.end - a.start
    const blen = b.end - b.start
    return blen - alen
  })
  const occupiedPositions = new Set<number>()
  for (const { key, offsetPx } of sortedBlocks) {
    const y = Math.round(length - offsetPx + viewOffsetPx)
    const labelStart = Math.max(y - 12, 0)
    let hasOverlap = y === 0
    if (!hasOverlap) {
      for (let i = labelStart; i < y; i++) {
        if (occupiedPositions.has(i)) {
          hasOverlap = true
          break
        }
      }
    }
    if (hasOverlap) {
      blockLabelKeysToHide.add(key)
    } else {
      for (let i = labelStart; i < y; i++) {
        occupiedPositions.add(i)
      }
    }
  }
  return blockLabelKeysToHide
}
/**
 * Given a scale ( bp/px ) and minimum distances (px) between major and minor
 * gridlines, return an object like `{ majorPitch: bp, minorPitch: bp }` giving
 * the gridline pitches to use.
 */
export function chooseGridPitch(
  scale: number,
  minMajorPitchPx: number,
  minMinorPitchPx: number,
) {
  scale = Math.abs(scale)
  const minMajorPitchBp = minMajorPitchPx * scale
  const majorMagnitude = +minMajorPitchBp.toExponential().split(/e/i, 2)[1]!

  let majorPitch = 10 ** majorMagnitude
  while (majorPitch < minMajorPitchBp) {
    majorPitch *= 2
    if (majorPitch >= minMajorPitchBp) {
      break
    }
    majorPitch *= 2.5
  }

  majorPitch = Math.max(majorPitch, 5)

  const majorPitchPx = majorPitch / scale

  let minorPitch = 0
  if (!(majorPitch % 10) && majorPitchPx / 10 >= minMinorPitchPx) {
    minorPitch = majorPitch / 10
  } else if (!(majorPitch % 5) && majorPitchPx / 5 >= minMinorPitchPx) {
    minorPitch = majorPitch / 5
  } else if (!(majorPitch % 2) && majorPitchPx / 2 >= minMinorPitchPx) {
    minorPitch = majorPitch / 2
  }

  return { majorPitch, minorPitch }
}

export function makeTicks(
  regions: ContentBlock[],
  bpPerPx: number,
  emitMajor = true,
  emitMinor = true,
) {
  const ticks = []
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)
  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (const { start, end, refName } of regions) {
    let index = 0

    const minBase = start
    const maxBase = end

    for (
      let base = Math.floor(minBase / iterPitch) * iterPitch;
      base < Math.ceil(maxBase / iterPitch) * iterPitch + 1;
      base += iterPitch
    ) {
      if (emitMinor && base % gridPitch.majorPitch) {
        ticks.push({ type: 'minor', base: base - 1, index, refName })
        index += 1
      } else if (emitMajor && Math.abs(base - start) > gridPitch.minorPitch) {
        ticks.push({ type: 'major', base: base - 1, index, refName })
        index += 1
      }
    }
  }
  return ticks
}
