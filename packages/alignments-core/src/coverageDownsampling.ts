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

export interface CoverageTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDepth: number
  nicedMax: number
  yTop: number
  yBottom: number
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

export interface CoverageRegion {
  depths: Float32Array
  startOffset: number
  regionStart: number
}

// Scans visible coverage bins and returns the maximum depth in the viewport.
// Used by debounced autoruns to normalize coverage Y-scale to visible data.
export function computeVisibleMaxDepth<D>(
  visibleBlocks: { start: number; end: number; key: string }[],
  dataMap: Map<string, D>,
  getCoverage: (data: D) => CoverageRegion | undefined,
) {
  let maxDepth = 0
  for (const block of visibleBlocks) {
    const data = dataMap.get(block.key)
    if (!data) {
      continue
    }
    const cov = getCoverage(data)
    if (!cov) {
      continue
    }
    const startBin = Math.max(
      0,
      Math.floor(block.start - cov.regionStart - cov.startOffset),
    )
    const endBin = Math.min(
      cov.depths.length,
      Math.ceil(block.end - cov.regionStart - cov.startOffset),
    )
    for (let i = startBin; i < endBin; i++) {
      const d = cov.depths[i]!
      if (d > maxDepth) {
        maxDepth = d
      }
    }
  }
  return maxDepth
}

export function getGlobalMaxCoverageDepth<D>(
  dataMap: Map<string, D>,
  getMaxDepth: (data: D) => number,
) {
  let max = 0
  for (const data of dataMap.values()) {
    const d = getMaxDepth(data)
    if (d > max) {
      max = d
    }
  }
  return max
}

export function getFirstCoverageEntry<D>(
  dataMap: Map<string, D>,
  getCoverage: (data: D) => (CoverageRegion & { maxDepth: number }) | undefined,
) {
  for (const data of dataMap.values()) {
    const cov = getCoverage(data)
    if (cov && cov.maxDepth > 0) {
      return cov
    }
  }
  return undefined
}

export interface DownsampledBins {
  positions: Float32Array
  mins: Float32Array
  maxs: Float32Array
  count: number
}

// Downsample per-bp depths into min/max bins for faithful peak/valley rendering.
// When depthCount <= targetBins, returns per-bp bins (min=0, max=depth).
// When depthCount > targetBins, aggregates into targetBins bins.
export function downsampleMinMax(
  depths: Float32Array,
  startOffset: number,
  targetBins: number,
  globalMaxDepth: number,
): DownsampledBins {
  const n = depths.length
  if (n === 0) {
    return {
      positions: new Float32Array(0),
      mins: new Float32Array(0),
      maxs: new Float32Array(0),
      count: 0,
    }
  }

  if (n <= targetBins) {
    let count = 0
    for (let i = 0; i < n; i++) {
      if (depths[i]! > 0) {
        count++
      }
    }
    const positions = new Float32Array(count)
    const mins = new Float32Array(count)
    const maxs = new Float32Array(count)
    let idx = 0
    for (let i = 0; i < n; i++) {
      const d = depths[i]!
      if (d > 0) {
        positions[idx] = startOffset + i
        mins[idx] = 0
        maxs[idx] = d / globalMaxDepth
        idx++
      }
    }
    return { positions, mins, maxs, count }
  }

  const bpPerBin = n / targetBins
  const positions = new Float32Array(targetBins)
  const mins = new Float32Array(targetBins)
  const maxs = new Float32Array(targetBins)
  let count = 0

  for (let b = 0; b < targetBins; b++) {
    const from = Math.floor(b * bpPerBin)
    const to = Math.min(Math.floor((b + 1) * bpPerBin), n)
    let lo = Infinity
    let hi = 0
    for (let i = from; i < to; i++) {
      const d = depths[i]!
      if (d < lo) {
        lo = d
      }
      if (d > hi) {
        hi = d
      }
    }
    if (hi > 0) {
      positions[count] = startOffset + from
      mins[count] = (lo === Infinity ? 0 : lo) / globalMaxDepth
      maxs[count] = hi / globalMaxDepth
      count++
    }
  }

  return {
    positions: positions.subarray(0, count),
    mins: mins.subarray(0, count),
    maxs: maxs.subarray(0, count),
    count,
  }
}
