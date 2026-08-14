import { BlockSet } from './blockTypes.ts'
import { intersection2 } from './range.ts'

import type { Base1DViewModel } from './calculateStaticBlocks.ts'

/**
 * Returns a BlockSet covering only the regions currently visible in the view.
 * Used by tracks where static blocks are not feasible. start/end/offsetPx may
 * be fractional.
 */
export default function calculateDynamicBlocks(
  model: Base1DViewModel,
  padding = true,
  elision = true,
) {
  const { offsetPx, displayedRegions, bpPerPx, width, minimumBlockWidth } =
    model

  // A zero-width view yields an empty BlockSet: intersection2 rejects the
  // degenerate window, so the loop pushes nothing. Mirrors calculateStaticBlocks
  // rather than throwing inside what callers read as a MobX computed.
  const invBpPerPx = 1 / bpPerPx
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  const lastRegionIndex = displayedRegions.length - 1
  for (
    let displayedRegionIndex = 0;
    displayedRegionIndex < displayedRegions.length;
    displayedRegionIndex++
  ) {
    // see calculateStaticBlocks: regions are laid out left to right, so nothing
    // past the window's right edge can intersect it
    if (displayedRegionLeftPx > windowRightPx) {
      break
    }
    const region = displayedRegions[displayedRegionIndex]!
    const { start: regionStart, end: regionEnd, reversed } = region
    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      // bp spanned between the region's left edge and the clipped block edges
      const leftBp = (leftPx - displayedRegionLeftPx) * bpPerPx
      const rightBp = (rightPx - displayedRegionLeftPx) * bpPerPx
      const start = reversed
        ? Math.max(regionStart, regionEnd - rightBp)
        : regionStart + leftBp
      const end = reversed
        ? regionEnd - leftBp
        : Math.min(regionEnd, regionStart + rightBp)
      // both reversed/forward offset formulae reduce algebraically to leftPx
      const blockOffsetPx = leftPx
      const widthPx = (end - start) * invBpPerPx

      // Under minimumBlockWidth this region is elided, and BlockSet merges an
      // elided block into a preceding elided run keeping only its widthPx — so
      // building the key and the block object is work thrown away, which at
      // whole-genome zoom on a fragmented assembly is nearly every region and
      // most of the frame. Two edges keep the skip output-identical: the first
      // region can never take it, because nothing has been pushed for the run
      // to merge into, so its leading padding block still gets built; the last
      // region is held out, because it may still owe a trailing padding block
      // keyed off its own key.
      const merged =
        elision &&
        regionWidthPx < minimumBlockWidth &&
        displayedRegionIndex !== lastRegionIndex &&
        blocks.growElidedRun(widthPx)

      if (!merged) {
        const { assemblyName, refName } = region
        // Pixel comparisons avoid the bpPerPx round-trip float drift that can
        // make end !== regionEnd even when the full region is in view.
        const isLeftEndOfDisplayedRegion = leftPx <= displayedRegionLeftPx
        const isRightEndOfDisplayedRegion = rightPx >= displayedRegionRightPx
        const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

        if (
          padding &&
          displayedRegionIndex === 0 &&
          isLeftEndOfDisplayedRegion
        ) {
          blocks.push({
            type: 'InterRegionPaddingBlock',
            key: `${key}-beforeFirstRegion`,
            widthPx: -offsetPx,
            offsetPx: blockOffsetPx + offsetPx,
            variant: 'boundary',
          })
        }

        const data = {
          assemblyName,
          refName,
          start,
          end,
          reversed,
          offsetPx: blockOffsetPx,
          displayedRegionIndex,
          widthPx,
          isLeftEndOfDisplayedRegion,
          isRightEndOfDisplayedRegion,
          key,
        }
        blocks.push(
          elision && regionWidthPx < minimumBlockWidth
            ? { ...data, type: 'ElidedBlock' }
            : { ...data, type: 'ContentBlock' },
        )

        if (
          padding &&
          displayedRegionIndex === lastRegionIndex &&
          isRightEndOfDisplayedRegion
        ) {
          const afterOffsetPx = blockOffsetPx + widthPx
          blocks.push({
            type: 'InterRegionPaddingBlock',
            key: `${key}-afterLastRegion`,
            widthPx: width - afterOffsetPx + offsetPx,
            offsetPx: afterOffsetPx,
            variant: 'boundary',
          })
        }
      }
    }
    displayedRegionLeftPx += regionWidthPx
  }
  return blocks
}
