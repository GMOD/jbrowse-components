import type { Dotplot1DViewModel } from '../model'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export function locstr(
  px: number,
  view: Dotplot1DViewModel,
  includeAsm = true,
) {
  const { assemblyName, refName, start, offset, oob } = view.pxToBp(px)
  const coord = Math.floor(start + offset)
  return oob
    ? 'out of bounds'
    : `${
        includeAsm ? `{${assemblyName}}` : ''
      }${refName}:${coord.toLocaleString('en-US')}`
}

export function getBlockLabelKeysToHide(
  blocks: BaseBlock[],
  length: number,
  viewOffsetPx: number,
) {
  const blockLabelKeysToHide = new Set<string>()
  const sortedBlocks = [...blocks].sort((a, b) => {
    const alen = a.end - a.start
    const blen = b.end - b.start
    return blen - alen
  })
  const positions = Array.from({ length: Math.round(length) })
  for (const { key, offsetPx } of sortedBlocks) {
    const y = Math.round(length - offsetPx + viewOffsetPx)
    const labelBounds = [Math.max(y - 12, 0), y]
    if (y === 0 || positions.slice(...labelBounds).some(Boolean)) {
      blockLabelKeysToHide.add(key)
    } else {
      positions.fill(true, ...labelBounds)
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
  const majorMagnitude = +Number(minMajorPitchBp)
    .toExponential()
    .split(/e/i)[1]!

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
  regions: BaseBlock[],
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
