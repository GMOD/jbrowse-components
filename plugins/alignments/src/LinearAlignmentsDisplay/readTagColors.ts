import { getQueryColor } from '@jbrowse/core/ui/colors'
import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/theme'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

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
const noStrand = packRgb(cssColorToRgb(colorNostrand))

// Resolve one read's per-read string (+ its strand, for the `ts` orientation
// tag) to a packed ABGR u32; 0 means "no color" (shader palette fallback).
type ColorResolver = (val: string, strand: number) => number

// Build the per-read color resolver once for a given scheme. All the
// scheme-invariant setup — the color-table parse (categorical tag), the
// name→color cache (mateRefName) — happens here, so it's paid once and reused
// across every region rather than rebuilt per region, and the scheme dispatch
// leaves the per-read hot loop entirely.
function makeColorResolver(
  colorBy: ColorBy,
  colorTagMap: Record<string, string>,
): ColorResolver {
  // Chromosome painting: hash each read's mate refName to its stable category10
  // color. A read with no mate (empty string) packs 0 rather than a hash of ''.
  // Names repeat across every read of a contig (and across regions), so the pack
  // is cached per distinct name.
  if (colorBy.type === 'mateRefName') {
    const cache = new Map<string, number>()
    return name => {
      if (name === '') {
        return 0
      }
      let color = cache.get(name)
      if (color === undefined) {
        color = packRgb(cssColorToRgb(getQueryColor(name)))
        cache.set(name, color)
      }
      return color
    }
  }
  const tag = colorBy.tag
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
  // Categorical tag: parse+pack the color table once.
  const packedByValue = new Map<string, number>()
  for (const [k, v] of Object.entries(colorTagMap)) {
    packedByValue.set(k, packRgb(cssColorToRgb(v)))
  }
  return val => packedByValue.get(val) ?? noStrand
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
// (`readTagValues`). Runs on the main thread so `colorTagMap` never crosses the
// worker boundary — keeping it out of `rpcProps()` makes the old
// discover→assign→refetch feedback loop structurally impossible. The shader
// reads `uint tagColor` and unpacks; 0 means "no color" (palette fallback).
export function buildReadTagColors(
  data: PileupDataResult,
  colorBy: ColorBy,
  colorTagMap: Record<string, string>,
): Uint32Array {
  return applyResolver(data, makeColorResolver(colorBy, colorTagMap))
}

// Overlay freshly-baked `readTagColors` onto each laid-out region. No-op outside
// the CPU-baked color schemes, where the worker's empty array leaves the shader
// on its palette fallback. Reading `colorTagMap` here is what makes tag coloring
// a tier-2 (main-thread recompute) setting rather than a tier-1 refetch. The
// resolver is built once and shared across regions.
export function overlayReadTagColors(
  map: Map<number, PileupDataResult>,
  colorBy: ColorBy | undefined,
  colorTagMap: Record<string, string>,
): Map<number, PileupDataResult> {
  const baked =
    colorBy?.type === 'mateRefName' ||
    (colorBy?.type === 'tag' && !!colorBy.tag)
  if (!colorBy || !baked) {
    return map
  }
  const resolve = makeColorResolver(colorBy, colorTagMap)
  const out = new Map<number, PileupDataResult>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readTagColors: applyResolver(data, resolve),
    })
  }
  return out
}
