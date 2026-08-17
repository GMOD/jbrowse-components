import {
  colorFwdStrand,
  colorNeutralRead,
  colorRevStrand,
} from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { bakedValueColor } from './colorTagUtils.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy } from '../shared/types.ts'

type ColorRgbTuple = [number, number, number]

function packRgb([r, g, b]: ColorRgbTuple) {
  return packAbgr(r, g, b, 255)
}

// Strand-tag (XS/TS/ts) coloring reuses the shared strand colors from theme.ts
// (its single source of truth) so it can't drift from "Color by strand".
const fwdStrand = packRgb(cssColorToRgb(colorFwdStrand))
const revStrand = packRgb(cssColorToRgb(colorRevStrand))
const noStrand = packRgb(cssColorToRgb(colorNeutralRead))

// Resolve one read's per-read string (+ its strand, for the `ts` orientation
// tag) to a packed ABGR u32; 0 means "no color" (shader palette fallback).
type ColorResolver = (val: string, strand: number) => number

// Build the per-read color resolver once for a given scheme. The scheme
// dispatch and the value→pack cache happen here, so both leave the per-read hot
// loop and the cache is reused across every region rather than rebuilt per
// region.
function makeColorResolver(colorBy: ColorBy): ColorResolver {
  // The strand tags first, and they have to be: they are `type: 'tag'` like any
  // other, but encode a strand rather than a categorical value, so they take
  // the fixed strand colors instead of a per-value one.
  const tag = colorBy.type === 'tag' ? colorBy.tag : undefined
  if (tag === 'XS' || tag === 'TS') {
    return val => (val === '-' ? revStrand : val === '+' ? fwdStrand : noStrand)
  }
  if (tag === 'ts') {
    return (val, strand) =>
      val === '-'
        ? strand === -1
          ? fwdStrand
          : revStrand
        : val === '+'
          ? strand === -1
            ? revStrand
            : fwdStrand
          : noStrand
  }
  // Chromosome painting and categorical tags alike: the color is a pure
  // function of the value (`bakedValueColor`), so nothing has to have
  // discovered it first.
  //
  // A read the scheme resolved no value for — no mate, or the tag absent, both
  // arriving as the empty string — packs 0. That is "no color", the shader's
  // palette fallback (colorPairLR, the same neutral an uncolored read paints)
  // rather than colorNeutralRead, and it is also what `readColorCategory` reads
  // to file the read under `noTagValue`. The tag encodes no strand, so "no
  // strand" was never the right neutral for it, and being a fixed light grey it
  // painted untagged reads BRIGHTER than ordinary reads under the dark theme,
  // where colorPairLR darkens and colorNeutralRead does not. The strand tags
  // above keep colorNeutralRead: there, absent genuinely means "strand
  // unknown".
  //
  // Values repeat across every read carrying them, and across regions, so the
  // pack is cached per distinct value. That cache is the ONLY thing the old
  // `colorTagMap` bought on this path — and it bought it in model state, where
  // a newly discovered value invalidated `readColorContext` and rebaked every
  // region already loaded.
  const cache = new Map<string, number>()
  return value => {
    if (value === '') {
      return 0
    }
    let color = cache.get(value)
    if (color === undefined) {
      color = packRgb(cssColorToRgb(bakedValueColor(colorBy, value)))
      cache.set(value, color)
    }
    return color
  }
}

function applyResolver(
  data: PileupDataResult,
  resolve: ColorResolver,
): Uint32Array {
  const tagValues = data.readTagValues ?? []
  const strands = data.readStrands
  const n = tagValues.length
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = resolve(tagValues[i] ?? '', strands[i] ?? 0)
  }
  return out
}

// Bake one ABGR u32 per read from the worker-reported per-read strings
// (`readTagValues`). Runs on the main thread, so the color table never crosses
// the worker boundary — keeping it out of `rpcProps()` makes the old
// discover→assign→refetch feedback loop structurally impossible. The shader
// reads `uint tagColor` and unpacks; 0 means "no color" (palette fallback).
export function buildReadTagColors(
  data: PileupDataResult,
  colorBy: ColorBy,
): Uint32Array {
  return applyResolver(data, makeColorResolver(colorBy))
}

// Overlay freshly-baked `readTagColors` onto each laid-out region. No-op outside
// the CPU-baked color schemes, where the worker's empty array leaves the shader
// on its palette fallback. Baking here rather than in the worker is what makes
// tag coloring a tier-2 (main-thread recompute) setting rather than a tier-1
// refetch. The resolver is built once and shared across regions.
export function overlayReadTagColors(
  map: Map<number, PileupDataResult>,
  colorBy: ColorBy | undefined,
): Map<number, PileupDataResult> {
  const baked =
    colorBy?.type === 'mateRefName' ||
    (colorBy?.type === 'tag' && !!colorBy.tag)
  if (!colorBy || !baked) {
    return map
  }
  const resolve = makeColorResolver(colorBy)
  const out = new Map<number, PileupDataResult>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readTagColors: applyResolver(data, resolve),
    })
  }
  return out
}
