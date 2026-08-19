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
  /**
   * Raw config value for symlog; `0` means "derive from the domain". Passed
   * through to `getScale` so the axis is built with the constant the renderer
   * normalizes with — resolving them separately would label ticks at heights
   * the bars are not drawn at.
   */
  symlogConstant?: number
}): YScaleTicks | undefined {
  const {
    height,
    domain,
    scaleType,
    minimalTicks,
    offset = YSCALEBAR_LABEL_OFFSET,
    symlogConstant,
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
  // `nice: false`: the caller's domain is the one the renderer is drawing with
  // (every wiggle-family `domain` getter has already been through
  // getNiceDomain), so nicing it a second time would move the axis off the
  // plot. It was a no-op only because every caller pre-nices — hand this a raw
  // [1, 1000] and it re-niced to [1, 1024], drawing a labelled tick at a value
  // the data never reaches.
  const scale = getScale({
    scaleType,
    domain: [domainMin, domainMax],
    range: [yBottom, yTop],
    symlogConstant,
    nice: false,
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
