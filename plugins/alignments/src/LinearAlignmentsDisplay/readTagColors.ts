import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { isBakedScheme } from '../shared/alignmentsColor.ts'

import type {
  LaidOutPileupData,
  TagColoredPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy } from '../shared/types.ts'
import type { BakedColorScale } from './bakedColorScale.ts'

type ColorRgbTuple = [number, number, number]

function packRgb([r, g, b]: ColorRgbTuple) {
  return packAbgr(r, g, b, 255)
}

// Strand-tag (XS/TS/ts) coloring reuses the shared strand colors from theme.ts
// (its single source of truth) so it can't drift from "Color by strand".
const fwdStrand = packRgb(cssColorToRgb(colorFwdStrand))
const revStrand = packRgb(cssColorToRgb(colorRevStrand))

// Resolve one read's per-read string (+ its strand, for the `ts` orientation
// tag) to a packed ABGR u32; 0 means "no color" (shader palette fallback).
type ColorResolver = (val: string, strand: number) => number

// One array for every region of every scheme that bakes nothing, because the
// renderer's upload memo compares `readTagColors` by IDENTITY to decide whether
// the read pass needs rewriting — a fresh empty array per region would report a
// recolor that didn't happen.
const NO_TAG_COLORS = new Uint32Array(0)

// Build the per-read color resolver once for a given scheme. The scheme
// dispatch and the value→pack cache happen here, so both leave the per-read hot
// loop and the cache is reused across every region rather than rebuilt per
// region.
function makeColorResolver(
  colorBy: ColorBy,
  scale: BakedColorScale,
): ColorResolver {
  // The strand tags first, and they have to be: they are `type: 'tag'` like any
  // other, but encode a strand rather than a categorical value, so they take
  // the fixed strand colors instead of a per-value one. A value that is neither
  // strand packs 0, the same neutral fallback as an absent tag below.
  const tag =
    colorBy.type === 'tag' && !scale.declared ? colorBy.tag : undefined
  if (tag === 'XS' || tag === 'TS') {
    return val => (val === '-' ? revStrand : val === '+' ? fwdStrand : 0)
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
          : 0
  }
  // A read the scheme resolved no value for — no mate, or the tag absent, both
  // arriving as the empty string — and a value the scale has no bin for pack 0.
  // That is "no color", the shader's palette fallback, and it is also what
  // `readColorCategory` reads to file the read under `noTagValue`. Values repeat
  // across reads and regions, so the pack is cached per distinct value.
  const cache = new Map<string, number>()
  return value => {
    if (value === '') {
      return 0
    }
    let color = cache.get(value)
    if (color === undefined) {
      const css = scale.color(value)
      color = css === undefined ? 0 : packRgb(cssColorToRgb(css))
      cache.set(value, color)
    }
    return color
  }
}

function applyResolver(
  data: WorkerPileupData,
  resolve: ColorResolver,
): Uint32Array {
  const tagValues = data.readTagValues
  const strands = data.readStrands
  // No values to bake from — a region fetched under a scheme that extracts none,
  // which the mid-switch window leaves laid out while the new colorBy is already
  // applied. Shares NO_TAG_COLORS rather than minting an empty array, for the
  // reason that constant exists: a fresh one reports a recolor by identity and
  // rewrites the read pass.
  if (tagValues === undefined) {
    return NO_TAG_COLORS
  }
  const n = tagValues.length
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = resolve(tagValues[i]!, strands[i]!)
  }
  return out
}

// Bake one ABGR u32 per read from the worker-reported per-read strings
// (`readTagValues`). Runs on the main thread, so the color table never crosses
// the worker boundary — keeping it out of `rpcProps()` makes the old
// discover→assign→refetch feedback loop structurally impossible. The shader
// reads `uint tagColor` and unpacks; 0 means "no color" (palette fallback).
export function buildReadTagColors(
  data: WorkerPileupData,
  colorBy: ColorBy,
  scale: BakedColorScale,
): Uint32Array {
  return applyResolver(data, makeColorResolver(colorBy, scale))
}

// Overlay freshly-baked `readTagColors` onto each laid-out region. Baking here
// rather than in the worker is what makes tag coloring a tier-2 (main-thread
// recompute) setting rather than a tier-1 refetch. The resolver is built once and
// shared across regions.
//
// The schemes that bake no per-read color get the empty array, which leaves the
// shader on its palette fallback. Stating it here rather than in the worker is
// the point of the tier: this pass owns the field, so "this scheme colors no
// read" is its answer to give, and `overlayReadColorCategories` — which reads the
// baked array to decide the `noTagValue` bucket — cannot be handed a region that
// never went through here.
export function overlayReadTagColors(
  map: Map<number, LaidOutPileupData>,
  colorBy: ColorBy | undefined,
  scale: BakedColorScale | undefined,
): Map<number, TagColoredPileupData> {
  const resolve =
    colorBy && scale && isBakedScheme(colorBy)
      ? makeColorResolver(colorBy, scale)
      : undefined
  const out = new Map<number, TagColoredPileupData>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readTagColors: resolve ? applyResolver(data, resolve) : NO_TAG_COLORS,
    })
  }
  return out
}
