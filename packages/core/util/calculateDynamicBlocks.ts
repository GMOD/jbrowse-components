import { assembleLocStringFast } from '.'
import { BlockSet } from './blockTypes'
import calculateStaticBlocks from './calculateStaticBlocks'
import { intersection2 } from './range'

import type { Base1DViewModel } from './calculateStaticBlocks'

/**
 * returns a BlockSet of which the `blocks` attribute is an array of 'dynamic
 * blocks', which are blocks representing only the regions that are visible in
 * the view right now. these are mostly used by tracks for which static blocks
 * are not feasible.
 *
 * each block is a plain JS object like:
 *   `{ refName, start, end, offsetPx, reversed? }`
 *
 * start and end are in bp, and start is always less than end, but if reversed
 * is true, startBp will be on the right side of the visible region.
 *
 * offsetPx is the number of pixels from the left edge of the view to the left
 * edge of the region
 *
 * NOTE: start, end, and offsetPx may all be fractional!
 *
 * @returns BlockSet of `{ refName, startBp, end, offset, reversed? }`
 */
export default function calculateDynamicBlocks(
  model: Base1DViewModel,
  padding = true,
  elision = true,
) {
  const { offsetPx, bpPerPx, width } = model

  if (!width) {
    throw new Error('view has no width, cannot calculate displayed blocks')
  }

  const staticBlocks = calculateStaticBlocks(
    model,
    padding,
    elision,
  ).getBlocks()
  const blocks = new BlockSet()
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  for (let i = 0; i < staticBlocks.length; i++) {
    const block = staticBlocks[i]!
    const blockLeftPx = block.offsetPx
    const blockRightPx = blockLeftPx + block.widthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      blockLeftPx,
      blockRightPx,
    )
    if (leftPx === undefined && rightPx === undefined) {
      continue
    }
    if (windowLeftPx > blockLeftPx && windowLeftPx < blockRightPx) {
      // Need to trim left
      if (block.isLeftEndOfDisplayedRegion === true) {
        block.isLeftEndOfDisplayedRegion = false
      }
      const offsetDiff = windowLeftPx - block.offsetPx
      block.offsetPx += offsetDiff
      block.widthPx -= offsetDiff
      if (block.type === 'ContentBlock') {
        const bpDiff = offsetDiff * bpPerPx
        if (block.reversed) {
          block.end -= bpDiff
        } else {
          block.start += bpDiff
        }
        block.key = `${assembleLocStringFast({
          assemblyName: block.assemblyName,
          refName: block.refName,
          start: block.start,
          end: block.end,
          reversed: block.reversed,
        })}-${block.regionNumber}${block.reversed ? '-reversed' : ''}`
      }
    }
    if (windowRightPx > blockLeftPx && windowRightPx < blockRightPx) {
      // Need to trim right
      if (block.isRightEndOfDisplayedRegion === true) {
        block.isRightEndOfDisplayedRegion = false
      }
      const rightDiff = block.offsetPx + block.widthPx - windowRightPx
      block.widthPx -= rightDiff
      if (block.type === 'ContentBlock') {
        const bpDiff = rightDiff * bpPerPx
        if (block.reversed) {
          block.start += bpDiff
        } else {
          block.end -= bpDiff
        }
        block.key = `${assembleLocStringFast({
          assemblyName: block.assemblyName,
          refName: block.refName,
          start: block.start,
          end: block.end,
          reversed: block.reversed,
        })}-${block.regionNumber}${block.reversed ? '-reversed' : ''}`
      }
    }

    const previousBlock = staticBlocks[i - 1]
    if (
      previousBlock?.type === 'ContentBlock' &&
      block.type === 'ContentBlock'
    ) {
      // Combine previous block and this block
      previousBlock.end = block.end
      previousBlock.widthPx += block.widthPx
    } else {
      blocks.push(block)
      continue
    }
  }
  return blocks
}
