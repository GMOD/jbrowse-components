import { readConfObject } from '@jbrowse/core/configuration'
import { getScale } from '@jbrowse/wiggle-core'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { ScaleOpts } from '@jbrowse/wiggle-core'

export {
  YSCALEBAR_LABEL_OFFSET,
  getNiceDomain,
  getOrigin,
  getScale,
} from '@jbrowse/wiggle-core'
export type { ScaleOpts } from '@jbrowse/wiggle-core'

// Default color used by wiggle config schema
export const WIGGLE_COLOR_DEFAULT = '#f0f'

export function getColorCallback(
  config: AnyConfigurationModel,
  opts?: { defaultColor?: string },
) {
  const colorIsCallback = config.color?.isCallback

  if (colorIsCallback) {
    return (feature: Feature) => readConfObject(config, 'color', { feature })
  }
  const color = readConfObject(config, 'color')
  const colorIsDefault = color === WIGGLE_COLOR_DEFAULT
  if (!colorIsDefault) {
    return () => color
  }
  if (opts?.defaultColor) {
    return () => opts.defaultColor!
  }
  // Bicolor pivot logic
  const pivotValue = readConfObject(config, 'bicolorPivotValue')
  const negColor = readConfObject(config, 'negColor')
  const posColor = readConfObject(config, 'posColor')
  return (_feature: Feature, score: number) =>
    score < pivotValue ? negColor : posColor
}

// There was confusion about whether source or name was required, and effort to
// remove one or the other was thwarted. Adapters like BigWigAdapter, even in
// the BigWigAdapter configSchema.ts, use a 'source' field though, while the
// word 'name' still allowed in the config too. To solve, we made name===source
export interface Source {
  baseUri?: string
  name: string
  source: string
  color?: string
  group?: string
}

export function toP(s = 0) {
  return +s.toPrecision(6)
}

export function serializeWiggleFeature(f: {
  get: (key: string) => unknown
  id: () => string
}) {
  return {
    uniqueId: f.id(),
    start: f.get('start'),
    end: f.get('end'),
    score: f.get('score'),
    source: f.get('source'),
    refName: f.get('refName'),
    maxScore: f.get('maxScore'),
    minScore: f.get('minScore'),
    summary: f.get('summary'),
  }
}

export function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

export const WIGGLE_FUDGE_FACTOR = 0.3
export const WIGGLE_CLIP_HEIGHT = 2

export interface ScaleValues {
  niceMin: number
  niceMax: number
  height: number
  linearRatio: number
  log2: number
  logMin: number
  logRatio: number
  isLog: boolean
}

export function getScaleValues(
  scaleOpts: ScaleOpts,
  height: number,
): ScaleValues {
  const scale = getScale({ ...scaleOpts, range: [0, height] })
  const domain = scale.domain() as [number, number]
  const niceMin = domain[0]
  const niceMax = domain[1]
  const domainSpan = niceMax - niceMin
  const isLog = scaleOpts.scaleType === 'log'

  const linearRatio = domainSpan !== 0 ? height / domainSpan : 0
  const log2 = Math.log(2)
  const logMin = Math.log(niceMin) / log2
  const logMax = Math.log(niceMax) / log2
  const logSpan = logMax - logMin
  const logRatio = logSpan !== 0 ? height / logSpan : 0

  return {
    niceMin,
    niceMax,
    height,
    linearRatio,
    log2,
    logMin,
    logRatio,
    isLog,
  }
}

// avoid drawing negative width features for SVG exports
export function fillRectCtx(
  x: number,
  y: number,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  color?: string,
) {
  if (width < 0) {
    x += width
    width = -width
  }
  if (height < 0) {
    y += height
    height = -height
  }

  if (color) {
    ctx.fillStyle = color
  }
  ctx.fillRect(x, y, width, height)
}
