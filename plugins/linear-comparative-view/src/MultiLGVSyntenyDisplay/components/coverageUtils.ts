import type { CoverageTicks } from '@jbrowse/plugin-alignments'

export const YSCALEBAR_LABEL_OFFSET = 5

export function niceNum(val: number) {
  if (val <= 0) {
    return 1
  }
  const exp = Math.floor(Math.log10(val))
  const frac = val / 10 ** exp
  let nice: number
  if (frac <= 1) {
    nice = 1
  } else if (frac <= 2) {
    nice = 2
  } else if (frac <= 5) {
    nice = 5
  } else {
    nice = 10
  }
  return nice * 10 ** exp
}

export function computeCoverageTicks(
  maxDepth: number,
  coverageHeight: number,
): CoverageTicks {
  const nicedMax = niceNum(maxDepth)
  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET

  const numTicks = coverageHeight < 70 ? 2 : 4
  const tickStep = nicedMax / (numTicks - 1)
  const ticks: { value: number; y: number }[] = []
  for (let i = 0; i < numTicks; i++) {
    const value = Math.round(i * tickStep)
    const y =
      coverageHeight -
      YSCALEBAR_LABEL_OFFSET -
      (value / nicedMax) * effectiveHeight
    ticks.push({ value, y })
  }

  return {
    ticks,
    height: coverageHeight,
    maxDepth,
    nicedMax,
    yTop: YSCALEBAR_LABEL_OFFSET,
    yBottom: coverageHeight - YSCALEBAR_LABEL_OFFSET,
  }
}
