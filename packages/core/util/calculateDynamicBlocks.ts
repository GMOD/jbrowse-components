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
    const originalBlock = staticBlocks[i]!
    const blockLeftPx = originalBlock.offsetPx
    const blockRightPx = blockLeftPx + originalBlock.widthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      blockLeftPx,
      blockRightPx,
    )
    if (leftPx === undefined && rightPx === undefined) {
      continue
    }

    const block =
      originalBlock.type === 'ContentBlock'
        ? new originalBlock.constructor(originalBlock)
        : new originalBlock.constructor({ ...originalBlock })

    let trimmedLeft = false
    let trimmedRight = false

    if (windowLeftPx > blockLeftPx && windowLeftPx < blockRightPx) {
      trimmedLeft = true
      if (block.isLeftEndOfDisplayedRegion === true) {
        block.isLeftEndOfDisplayedRegion = false
      }
      const offsetDiff = windowLeftPx - blockLeftPx
      block.offsetPx = windowLeftPx
      block.widthPx = originalBlock.widthPx - offsetDiff
      if (block.type === 'ContentBlock') {
        const bpDiff = offsetDiff * bpPerPx
        if (block.reversed) {
          block.end = originalBlock.end - bpDiff
        } else {
          block.start = originalBlock.start + bpDiff
        }
      }
    }
    if (windowRightPx > blockLeftPx && windowRightPx < blockRightPx) {
      trimmedRight = true
      if (block.isRightEndOfDisplayedRegion === true) {
        block.isRightEndOfDisplayedRegion = false
      }
      const rightDiff = blockRightPx - windowRightPx
      if (trimmedLeft) {
        block.widthPx -= rightDiff
      } else {
        block.widthPx = originalBlock.widthPx - rightDiff
      }
      if (block.type === 'ContentBlock') {
        const bpDiff = rightDiff * bpPerPx
        if (block.reversed) {
          if (trimmedLeft) {
            block.start = block.end - block.widthPx * bpPerPx
          } else {
            block.start = originalBlock.start + bpDiff
          }
        } else {
          if (trimmedLeft) {
            block.end = block.start + block.widthPx * bpPerPx
          } else {
            block.end = originalBlock.end - bpDiff
          }
        }
      }
    }

    if (block.type === 'ContentBlock' && (trimmedLeft || trimmedRight)) {
      block.key = `${assembleLocStringFast({
        assemblyName: block.assemblyName,
        refName: block.refName,
        start: block.start,
        end: block.end,
        reversed: block.reversed,
      })}-${block.regionNumber}${block.reversed ? '-reversed' : ''}`
    }

    blocks.push(block)
  }
  return blocks
}
