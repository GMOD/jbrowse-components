import { category10 } from '@jbrowse/core/ui/colors'
import {
  cssColorToABGR,
  packAbgr,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  continuousRampConfig,
  hashString,
} from '@jbrowse/synteny-core'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
import type { Rgb, SyntenyColorBy } from '@jbrowse/synteny-core'

export type DotplotColorFn = (data: DotplotRpcData, index: number) => number

function alphaByte(alpha: number) {
  return Math.round(alpha * 255)
}

function packColor(r: number, g: number, b: number, alpha: number) {
  return packAbgr(r, g, b, alphaByte(alpha))
}

// Pack a CSS color from the shared colorSchemes at the view's alpha. Going
// through colorSchemes rather than a local literal is what keeps the dotplot's
// strand/default colors from drifting off the synteny renderer's (which packs
// the same constants via cssColorToABGR).
function packCss(css: string, alpha: number) {
  return withAbgrAlpha(cssColorToABGR(css), alphaByte(alpha))
}

// Query/target chromosome-painting palette, pre-packed (alpha applied per
// color-function build). Drop category10's grey (#7f7f7f): a grey point reads as
// uncolored, and a genome whose (hashed) chromosome lands on that slot paints
// muddy grey — matches the synteny nameColorPalette so the two views can't
// drift.
const nameColorAbgr = category10
  .filter(hex => hex.toLowerCase() !== '#7f7f7f')
  .map(hex => cssColorToABGR(hex))

// Bake a ramp into a 256-entry packed-ABGR LUT once per color-function build, so
// the per-feature path (thousands of segments) is a single array index — no HSL
// math, allocation, or destructuring in the hot loop. `max` normalizes the raw
// value into the [0,1] LUT domain; negative values are the worker's
// missing-data sentinel and paint red.
function rampColorFn(
  values: Float32Array,
  toRgb: (norm: number) => Rgb,
  max: number,
  alpha: number,
): DotplotColorFn {
  const missing = packCss(colorSchemes.default.cigarColors.M, alpha)
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = toRgb(i / 255)
    lut[i] = packColor(r, g, b, alpha)
  }
  return (_data, i) => {
    const v = values[i]!
    // Clamp to the LUT's 0..255 domain *before* truncating: applying Math.min to
    // the float (not to the already-`| 0`'d int) keeps a pathological v/max from
    // int32-overflowing to a negative index that would read past the LUT.
    return v < 0 ? missing : lut[(Math.min(255, (v / max) * 255) + 0.5) | 0]!
  }
}

function strandColorFn(alpha: number): DotplotColorFn {
  const neg = packCss(colorSchemes.strand.negColor, alpha)
  const pos = packCss(colorSchemes.strand.posColor, alpha)
  return (d, i) => (d.strands[i] === -1 ? neg : pos)
}

function nameColorFn(
  alpha: number,
  pick: (d: DotplotRpcData, i: number) => string,
): DotplotColorFn {
  const palette = nameColorAbgr.map(c => withAbgrAlpha(c, alphaByte(alpha)))
  const cache = new Map<string, number>()
  return (d, i) => {
    const name = pick(d, i)
    let color = cache.get(name)
    if (color === undefined) {
      color = palette[hashString(name) % palette.length]!
      cache.set(name, color)
    }
    return color
  }
}

function constantColorFn(packed: number): DotplotColorFn {
  return () => packed
}

function rampConfigColorFn(
  values: Float32Array,
  mode: keyof typeof continuousRampConfig,
  alpha: number,
): DotplotColorFn {
  const { toRgb, maxValue } = continuousRampConfig[mode]
  return rampColorFn(values, toRgb, maxValue, alpha)
}

export function createDotplotColorFunction(
  colorBy: SyntenyColorBy,
  alpha: number,
  data: DotplotRpcData,
  trackColor: string,
): DotplotColorFn {
  switch (colorBy) {
    // One flat color for every point in this track, so overlaid tracks are told
    // apart by hue rather than all painting the conventional black.
    case 'track':
      return constantColorFn(packCss(trackColor, alpha))
    case 'strand':
      return strandColorFn(alpha)
    case 'query':
    // 'reference' is a stacked-view (linear synteny) mode; the two-genome
    // dotplot has no anchor to key on, so it colors by query like 'query'.
    // falls through
    case 'reference':
      return nameColorFn(alpha, (d, i) => d.refNames[i]!)
    case 'target':
      return nameColorFn(alpha, (d, i) => d.mateRefNames[i]!)
    case 'identity':
      return rampConfigColorFn(data.identities, 'identity', alpha)
    case 'meanQueryIdentity':
      return rampConfigColorFn(data.meanIdentities, 'meanQueryIdentity', alpha)
    case 'mappingQuality':
      return rampConfigColorFn(data.mappingQuals, 'mappingQuality', alpha)
    // Dotplot keeps a plain black default (its conventional line color) rather
    // than the synteny ribbon's red.
    case 'default':
      return constantColorFn(packCss(colorSchemes.default.pointColor, alpha))
  }
}

// Pure function: one packed-ABGR color per line segment, from the segment ->
// feature map the geometry builder emitted plus the current palette. This is the
// gpuProps half of the rpcProps/gpuProps split — a colorBy or alpha change
// reruns only this, leaving the positions (and the CIGAR walk that produced
// them) untouched.
export function computeDotplotColors({
  instanceData,
  rpcData,
  colorBy,
  alpha,
  trackColor,
}: {
  instanceData: DotplotInstanceData
  rpcData: DotplotRpcData
  colorBy: SyntenyColorBy
  alpha: number
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
}) {
  const { instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createDotplotColorFunction(
    colorBy,
    alpha,
    rpcData,
    trackColor,
  )
  const out = new Uint32Array(instanceCount)
  for (let i = 0; i < instanceCount; i++) {
    out[i] = colorFn(rpcData, instanceFeatureIdx[i]!)
  }
  return out
}
