import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import { isBakedField } from '../shared/alignmentsColor.ts'
import { fieldTag } from '../shared/facetLabels.ts'
import { MAPQ_UNAVAILABLE } from '../shared/util.ts'
import { bakedValueOrder } from './colorTagUtils.ts'

import type {
  LaidOutPileupData,
  FillColoredPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
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

// One array for every region of every field that bakes nothing, because the
// renderer's upload memo compares `readFillColors` by IDENTITY to decide whether
// the read pass needs rewriting — a fresh empty array per region would report a
// recolor that didn't happen.
const NO_FILL_COLORS = new Uint32Array(0)

// The strand tags are tags like any other but encode a strand rather than a
// categorical value, so they take the fixed strand colors instead of a
// per-value one. A value that is neither strand packs 0, the neutral fallback.
function strandResolver(
  colorField: string | undefined,
  scale: BakedColorScale,
): ColorResolver | undefined {
  const tag = scale.declared ? undefined : fieldTag(colorField)
  return tag === 'XS' || tag === 'TS'
    ? val => (val === '-' ? revStrand : val === '+' ? fwdStrand : 0)
    : tag === 'ts'
      ? (val, strand) =>
          val === '-'
            ? strand === -1
              ? fwdStrand
              : revStrand
            : val === '+'
              ? strand === -1
                ? revStrand
                : fwdStrand
              : 0
      : undefined
}

function applyResolver(data: WorkerPileupData, resolve: ColorResolver) {
  const tagValues = data.readTagValues
  const strands = data.readStrands
  if (tagValues === undefined) {
    return NO_FILL_COLORS
  }
  const n = tagValues.length
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = resolve(tagValues[i]!, strands[i]!)
  }
  return out
}

// No packed color has a zero alpha byte except "no color" itself.
const PENDING = 1

// A read the field resolved no value for (no mate, or the tag absent, both
// arriving as the empty string) and a value the scale has no bin for pack 0:
// "no color", the shader's palette fallback, which `readColorCategory` also
// reads to file the read under `noTagValue`. The pack is cached per distinct
// value across every region. The values the deal has yet to place are dealt
// together after the walk, in `bakedValueOrder`, so which read comes first does
// not pick a collided pair's colors and the key, dealing in that order too,
// agrees (ADR-205); a settled value packs at its first read.
function valueBaker(scale: BakedColorScale) {
  const cache = new Map<string, number>()
  const pack = (value: string) => {
    const css = scale.color(value)
    return css === undefined ? 0 : packRgb(cssColorToRgb(css))
  }
  const settled = scale.kind === 'categorical' ? scale.settled : () => true
  return (data: WorkerPileupData) => {
    const tagValues = data.readTagValues
    if (tagValues === undefined) {
      return NO_FILL_COLORS
    }
    const n = tagValues.length
    const out = new Uint32Array(n)
    const unseen = new Set<string>()
    for (let i = 0; i < n; i++) {
      const value = tagValues[i]!
      if (value !== '') {
        let color = cache.get(value)
        if (color === undefined) {
          if (settled(value)) {
            color = pack(value)
          } else {
            unseen.add(value)
            color = PENDING
          }
          cache.set(value, color)
        }
        out[i] = color
      }
    }
    if (unseen.size > 0) {
      const values = [...unseen]
      for (const value of values.sort(bakedValueOrder(values))) {
        cache.set(value, pack(value))
      }
      for (let i = 0; i < n; i++) {
        if (out[i] === PENDING) {
          out[i] = cache.get(tagValues[i]!)!
        }
      }
    }
    return out
  }
}

// Bake one ABGR u32 per read from the worker-reported per-read strings
// (`readTagValues`). Runs on the main thread, so the color table never crosses
// the worker boundary — keeping it out of `rpcProps()` makes the old
// discover→assign→refetch feedback loop structurally impossible. The shader
// reads `uint tagColor` and unpacks; 0 means "no color" (palette fallback).
export function buildReadFillColors(
  data: WorkerPileupData,
  colorField: string | undefined,
  scale: BakedColorScale,
): Uint32Array {
  return bakerFor(colorField, scale)(data)
}

// MAPQ has 255 scores worth a color, so the scale is evaluated once per score
// and each read is an index into the table; 255 is unavailable, its own bucket.
function mapqColorTable(scale: BakedColorScale) {
  const table = new Uint32Array(256)
  for (let mapq = 0; mapq < MAPQ_UNAVAILABLE; mapq++) {
    const css = scale.color(`${mapq}`)
    table[mapq] = css === undefined ? 0 : packRgb(cssColorToRgb(css))
  }
  return table
}

function applyMapqTable(data: WorkerPileupData, table: Uint32Array) {
  const mapqs = data.readMapqs
  const out = new Uint32Array(mapqs.length)
  for (let i = 0; i < mapqs.length; i++) {
    out[i] = table[mapqs[i]!]!
  }
  return out
}

function bakerFor(colorField: string | undefined, scale: BakedColorScale) {
  if (colorField === 'mapq') {
    const table = mapqColorTable(scale)
    return (data: WorkerPileupData) => applyMapqTable(data, table)
  }
  const strand = strandResolver(colorField, scale)
  return strand
    ? (data: WorkerPileupData) => applyResolver(data, strand)
    : valueBaker(scale)
}

// Overlay freshly-baked `readFillColors` onto each laid-out region. Baking here
// rather than in the worker is what makes tag coloring a tier-2 (main-thread
// recompute) setting rather than a tier-1 refetch. The resolver is built once and
// shared across regions.
//
// The fields that bake no per-read color get the empty array, which leaves the
// shader on its palette fallback. Stating it here rather than in the worker is
// the point of the tier: this pass owns the field, so "this field colors no
// read" is its answer to give, and `overlayReadColorCategories` — which reads the
// baked array to decide the `noTagValue` bucket — cannot be handed a region that
// never went through here.
export function overlayReadFillColors(
  map: Map<number, LaidOutPileupData>,
  colorField: string | undefined,
  scale: BakedColorScale | undefined,
): Map<number, FillColoredPileupData> {
  const bake =
    scale && isBakedField(colorField) ? bakerFor(colorField, scale) : undefined
  const out = new Map<number, FillColoredPileupData>()
  for (const [idx, data] of map) {
    out.set(idx, {
      ...data,
      readFillColors: bake ? bake(data) : NO_FILL_COLORS,
    })
  }
  return out
}
