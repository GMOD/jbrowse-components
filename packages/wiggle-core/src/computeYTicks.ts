import { YSCALEBAR_LABEL_OFFSET } from './constants.ts'
import { getScale } from './scale.ts'
import { axisPlotBox } from './yScaleTicks.ts'

import type { YScaleTicks } from './yScaleTicks.ts'

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
  // The same box the renderer paints into, so a tick lands on its own data. It
  // used to end a pixel short of it, to keep the spine's 1px stroke inside
  // multi-wiggle's row — that belongs in the drawing, and is now
  // `clampStrokeInsideAxis`.
  const { yTop, yBottom } = axisPlotBox(height, offset)
  const scale = getScale({
    scaleType,
    domain: [domainMin, domainMax],
    range: [yBottom, yTop],
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
