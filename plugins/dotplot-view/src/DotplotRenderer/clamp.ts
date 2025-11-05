import type { Feature } from '@jbrowse/core/util'

const r = 'fell outside of range due to CIGAR string'
const lt = '(less than min coordinate of feature)'
const gt = '(greater than max coordinate of feature)'
const fudgeFactor = 1 // allow 1px fuzzyness before warn

export function clampWithWarnX(
  num: number,
  min: number,
  max: number,
  feature: Feature,
  warnings: Warning[],
) {
  const strand = feature.get('strand') || 1
  if (strand === -1) {
    ;[max, min] = [min, max]
  }
  if (num < min - fudgeFactor) {
    let start = feature.get('start')
    let end = feature.get('end')
    const refName = feature.get('refName')
    if (strand === -1) {
      ;[end, start] = [start, end]
    }

    warnings.push({
      message: `feature at (X ${refName}:${start}-${end}) ${r} ${lt}`,
      effect: 'clipped the feature',
    })
    return min
  }
  if (num > max + fudgeFactor) {
    const strand = feature.get('strand') || 1
    const start = strand === 1 ? feature.get('start') : feature.get('end')
    const end = strand === 1 ? feature.get('end') : feature.get('start')
    const refName = feature.get('refName')

    warnings.push({
      message: `feature at (X ${refName}:${start}-${end}) ${r} ${gt}`,
      effect: 'clipped the feature',
    })
    return max
  }
  return num
}

export function clampWithWarnY(
  num: number,
  min: number,
  max: number,
  feature: Feature,
  warnings: Warning[],
) {
  if (num < min - fudgeFactor) {
    const mate = feature.get('mate')
    const { refName, start, end } = mate
    warnings.push({
      message: `feature at (Y ${refName}:${start}-${end}) ${r} ${lt}`,
      effect: 'clipped the feature',
    })
    return min
  }
  if (num > max + fudgeFactor) {
    const mate = feature.get('mate')
    const { refName, start, end } = mate

    warnings.push({
      message: `feature at (Y ${refName}:${start}-${end}) ${r} ${gt}`,
      effect: 'clipped the feature',
    })
    return max
  }
  return num
}

export interface Warning {
  message: string
  effect: string
}
