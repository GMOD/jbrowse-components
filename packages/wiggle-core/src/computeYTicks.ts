import { getScale } from './scale.ts'

import type { YScaleTicks } from './index.ts'

// kept in sync with the export in index.ts — duplicated here to avoid a
// circular import (index.ts re-exports computeYTicks).
const YSCALEBAR_LABEL_OFFSET = 5

// Builds Y-axis tick positions for a wiggle-family display: tick values come
// from d3's scale.ticks(4) at normal heights, or fall back to the domain
// endpoints for short tracks / when the user opts into minimal ticks.
export function computeYTicks(opts: {
  height: number
  domain: [number, number] | number[] | undefined
  scaleType: string
  minimalTicks: boolean
  offset?: number
}): YScaleTicks | undefined {
  const {
    height,
    domain,
    scaleType,
    minimalTicks,
    offset = YSCALEBAR_LABEL_OFFSET,
  } = opts
  const domainMin = domain?.[0]
  const domainMax = domain?.[1]
  if (domainMin === undefined || domainMax === undefined) {
    return undefined
  }
  const yTop = offset
  const yBottom = height - offset - 1
  const scale = getScale({
    scaleType,
    domain: [domainMin, domainMax],
    range: [yBottom, yTop],
    inverted: false,
  })
  const values =
    height < 100 || minimalTicks
      ? domainMin === domainMax
        ? [domainMin]
        : [domainMin, domainMax]
      : scale.ticks(4)
  return {
    items: values.map(v => ({ value: v, y: scale(v) })),
    yTop,
    yBottom,
  }
}
