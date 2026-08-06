import { category10 } from '@jbrowse/core/ui/colors'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import {
  colorSchemes,
  hashString,
  rampNorm,
  resolveContinuousMode,
} from '@jbrowse/synteny-core'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'
import type { ContinuousMode, SyntenyColorBy } from '@jbrowse/synteny-core'

export type DotplotColorFn = (data: DotplotRpcData, index: number) => number

// Every color packed in this module is fully OPAQUE. The plot-wide opacity
// slider is a render parameter — the shader's `alpha` uniform and
// `DotplotDrawParams.alpha` on the Canvas2D/SVG side — never baked into these
// bytes; see `DotplotRenderState.alpha`. It used to be a build input to every
// function below, which made an opacity drag recompute this whole array, re-pack
// every instance and re-upload the buffer once per frame.
//
// The scheme colors come from the shared `colorSchemes` rather than local
// literals, which is what keeps the dotplot's strand/default colors from
// drifting off the synteny renderer's (it packs the same constants the same
// way).

// Query/target chromosome-painting palette, pre-packed. Drop category10's grey
// (#7f7f7f): a grey point reads as uncolored, and a genome whose (hashed)
// chromosome lands on that slot paints muddy grey — matches the synteny
// nameColorPalette so the two views can't drift.
const nameColorAbgr = category10
  .filter(hex => hex.toLowerCase() !== '#7f7f7f')
  .map(hex => cssColorToABGR(hex))

// Bake a ramp into a 256-entry packed-ABGR LUT once per color-function build, so
// the per-feature path (thousands of segments) is a single array index — no HSL
// math, allocation, or destructuring in the hot loop. `max` normalizes the raw
// value into the [0,1] LUT domain; negative values are the worker's
// missing-data sentinel and paint red.
function continuousColorFn(
  mode: ContinuousMode,
  data: DotplotRpcData,
): DotplotColorFn {
  const missing = cssColorToABGR(colorSchemes.default.cigarColors.M)
  const values = data.attributes[mode.attribute]
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = mode.toRgb(i / 255)
    lut[i] = packAbgr(r, g, b, 255)
  }
  return (_data, i) => {
    const v = values?.[i]
    // Clamp to the LUT's 0..255 domain *before* truncating: applying Math.min to
    // the float (not to the already-`| 0`'d int) keeps a pathological value from
    // int32-overflowing to a negative index that would read past the LUT.
    return v === undefined || v < 0
      ? missing
      : lut[(Math.min(255, rampNorm(mode, v) * 255) + 0.5) | 0]!
  }
}

function strandColorFn(): DotplotColorFn {
  const neg = cssColorToABGR(colorSchemes.strand.negColor)
  const pos = cssColorToABGR(colorSchemes.strand.posColor)
  return (d, i) => (d.strands[i] === -1 ? neg : pos)
}

function nameColorFn(
  pick: (d: DotplotRpcData, i: number) => string,
): DotplotColorFn {
  const cache = new Map<string, number>()
  return (d, i) => {
    const name = pick(d, i)
    let color = cache.get(name)
    if (color === undefined) {
      color = nameColorAbgr[hashString(name) % nameColorAbgr.length]!
      cache.set(name, color)
    }
    return color
  }
}

function constantColorFn(packed: number): DotplotColorFn {
  return () => packed
}

export function createDotplotColorFunction(
  colorBy: SyntenyColorBy,
  data: DotplotRpcData,
  trackColor: string,
): DotplotColorFn {
  // Every continuous mode in one arm, preset or attribute; see the synteny
  // renderer's counterpart for why this is not a switch case per measurement.
  const continuous = resolveContinuousMode(colorBy, data.attributeRanges)
  if (continuous) {
    return continuousColorFn(continuous, data)
  }
  switch (colorBy) {
    // One flat color for every point in this track, so overlaid tracks are told
    // apart by hue rather than all painting the conventional black.
    case 'track':
      return constantColorFn(cssColorToABGR(trackColor))
    case 'strand':
      return strandColorFn()
    case 'query':
    // 'reference' is a stacked-view (linear synteny) mode; the two-genome
    // dotplot has no anchor to key on, so it colors by query like 'query'.
    // falls through
    case 'reference':
      return nameColorFn((d, i) => d.refNames[i]!)
    case 'target':
      return nameColorFn((d, i) => d.mateRefNames[i]!)
    // Dotplot keeps a plain black default (its conventional line color) rather
    // than the synteny ribbon's red.
    default:
      return constantColorFn(cssColorToABGR(colorSchemes.default.pointColor))
  }
}

// Pure function: one packed-ABGR color per line segment, from the segment ->
// feature map the geometry builder emitted plus the current palette. This is the
// gpuProps half of the rpcProps/gpuProps split — a colorBy change reruns only
// this, leaving the positions (and the CIGAR walk that produced them)
// untouched. Opacity is deliberately NOT an input: it is a render parameter, so
// the slider redraws without touching this array at all.
export function computeDotplotColors({
  instanceData,
  rpcData,
  colorBy,
  trackColor,
}: {
  instanceData: DotplotInstanceData
  rpcData: DotplotRpcData
  colorBy: SyntenyColorBy
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
}) {
  const { instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createDotplotColorFunction(colorBy, rpcData, trackColor)
  const out = new Uint32Array(instanceCount)
  for (let i = 0; i < instanceCount; i++) {
    out[i] = colorFn(rpcData, instanceFeatureIdx[i]!)
  }
  return out
}
