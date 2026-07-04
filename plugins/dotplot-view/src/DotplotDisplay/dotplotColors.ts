import { category10 } from '@jbrowse/core/ui/colors'
import {
  getBlue,
  getGreen,
  getRed,
  packAbgr,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import {
  continuousRampConfig,
  divergingIdentityRgb,
  hashString,
} from '@jbrowse/synteny-core'

import type { DotplotRpcData } from './types.ts'
import type { Rgb, SyntenyColorBy } from '@jbrowse/synteny-core'

export type DotplotColorFn = (data: DotplotRpcData, index: number) => number

function packColor(r: number, g: number, b: number, alpha: number) {
  return packAbgr(r, g, b, Math.round(alpha * 255))
}

// Query/target chromosome-painting palette. Drop category10's grey (#7f7f7f):
// a grey point reads as uncolored, and a genome whose (hashed) chromosome lands
// on that slot paints muddy grey — matches the synteny nameColorPalette so the
// two views can't drift.
const nameColorRgb = category10
  .filter(hex => hex.toLowerCase() !== '#7f7f7f')
  .map(hex => {
    const c = parseCssColor(hex)
    return [getRed(c), getGreen(c), getBlue(c)] as const
  })

export function unpackColorToCSS(packed: number) {
  const r = packed & 0xff
  const g = (packed >>> 8) & 0xff
  const b = (packed >>> 16) & 0xff
  const a = (packed >>> 24) / 255
  return `rgba(${r},${g},${b},${a})`
}

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
  const missing = packColor(255, 0, 0, alpha)
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = toRgb(i / 255)
    lut[i] = packColor(r, g, b, alpha)
  }
  return (_data, i) => {
    const v = values[i]!
    return v < 0 ? missing : lut[Math.min(255, ((v / max) * 255 + 0.5) | 0)]!
  }
}

function strandColorFn(alpha: number): DotplotColorFn {
  const neg = packColor(0, 0, 255, alpha)
  const pos = packColor(255, 0, 0, alpha)
  return (d, i) => (d.strands[i] === -1 ? neg : pos)
}

function nameColorFn(
  alpha: number,
  pick: (d: DotplotRpcData, i: number) => string,
): DotplotColorFn {
  const palette = nameColorRgb.map(([r, g, b]) => packColor(r, g, b, alpha))
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
): DotplotColorFn {
  switch (colorBy) {
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
    // Diverging LUT is indexed by identity directly; the pivot remap is inside
    // divergingIdentityRgb, so its normalization max is 1.
    case 'identityDiverging':
      return rampColorFn(data.identities, divergingIdentityRgb, 1, alpha)
    case 'meanQueryIdentity':
      return rampConfigColorFn(data.meanIdentities, 'meanQueryIdentity', alpha)
    case 'meanQueryMappingQuality':
      return rampConfigColorFn(
        data.meanScores,
        'meanQueryMappingQuality',
        alpha,
      )
    case 'mappingQuality':
      return rampConfigColorFn(data.mappingQuals, 'mappingQuality', alpha)
    // Dotplot keeps a plain black default (its conventional line color) rather
    // than the synteny ribbon's red.
    case 'default':
      return constantColorFn(packColor(0, 0, 0, alpha))
  }
}
