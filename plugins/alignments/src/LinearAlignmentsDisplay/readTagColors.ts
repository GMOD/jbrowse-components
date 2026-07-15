import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/theme'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { ColorBy } from '../shared/types.ts'

type ColorRgbTuple = [number, number, number]

// Strand-tag (XS/TS/ts) coloring reuses the shared strand colors from theme.ts
// (its single source of truth) so it can't drift from "Color by strand".
const fwdStrandRgb = cssColorToRgb(colorFwdStrand)
const revStrandRgb = cssColorToRgb(colorRevStrand)
const nostrandRgb = cssColorToRgb(colorNostrand)

// Bake one ABGR u32 per read from the worker-reported per-read tag values
// (`readTagValues`) and the main-thread `colorTagMap`. Runs on the main thread
// so `colorTagMap` never crosses the worker boundary — keeping it out of
// `rpcProps()` makes the old discover→assign→refetch feedback loop structurally
// impossible. The shader reads `uint tagColor` and unpacks; 0 means "no tag
// color" (palette fallback).
export function buildReadTagColors(
  data: PileupDataResult,
  colorBy: ColorBy,
  colorTagMap: Record<string, string>,
): Uint32Array {
  const tag = colorBy.tag!
  const tagValues = data.readTagValues ?? []
  const strands = data.readStrands
  const n = tagValues.length
  const out = new Uint32Array(n)

  const parsedColors = new Map<string, ColorRgbTuple>()
  for (const [k, v] of Object.entries(colorTagMap)) {
    parsedColors.set(k, cssColorToRgb(v))
  }

  for (let i = 0; i < n; i++) {
    const val = tagValues[i] ?? ''
    let rgb: ColorRgbTuple
    if (tag === 'XS' || tag === 'TS') {
      rgb =
        val === '-' ? revStrandRgb : val === '+' ? fwdStrandRgb : nostrandRgb
    } else if (tag === 'ts') {
      const featureStrand = strands[i]
      if (val === '-') {
        rgb = featureStrand === -1 ? fwdStrandRgb : revStrandRgb
      } else if (val === '+') {
        rgb = featureStrand === -1 ? revStrandRgb : fwdStrandRgb
      } else {
        rgb = nostrandRgb
      }
    } else {
      rgb = parsedColors.get(val) ?? nostrandRgb
    }
    out[i] = packAbgr(rgb[0], rgb[1], rgb[2], 255)
  }
  return out
}

// Overlay freshly-baked `readTagColors` onto each laid-out region. No-op
// outside tag color mode, where the worker's empty array leaves the shader on
// its palette fallback. Reading `colorTagMap` here is what makes tag coloring a
// tier-2 (main-thread recompute) setting rather than a tier-1 refetch.
export function overlayReadTagColors(
  map: Map<number, PileupDataResult>,
  colorBy: ColorBy | undefined,
  colorTagMap: Record<string, string>,
): Map<number, PileupDataResult> {
  if (colorBy?.type !== 'tag' || !colorBy.tag) {
    return map
  }
  const out = new Map<number, PileupDataResult>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readTagColors: buildReadTagColors(data, colorBy, colorTagMap),
    })
  }
  return out
}
