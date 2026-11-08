import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import {
  bandGroundColor,
  blendOverGround,
  isInstanceInvisible,
  unpack,
} from '@jbrowse/synteny-core'

import type { ComparativeAxis } from './testEnv.ts'
import type { rampKeyOf } from '@jbrowse/core/ui/rampKey'

/**
 * What the synteny and dotplot adapters compare: each alignment's drawn
 * marks in the color and alpha they composite at, the alignments the filter
 * admits, the key as a host draws it, and the opacity level.
 */
export const COMPARATIVE_DECISIONS = [
  'colors',
  'admitted',
  'key',
  'level',
] as const

const rounded = (alpha: number) => Math.round(alpha * 1e4) / 1e4

/** An axis as a host sends it, with the assembly it deals contig colors by. */
export const hostAxis = ({ assembly, regions, width }: ComparativeAxis) => ({
  assembly,
  regions,
  width,
})

/**
 * A display's per-instance colors as each alignment's marks, `[color,
 * alpha]` in draw order at the view's opacity `level`, leaving out the ones
 * too faint to paint, as a renderer does, and the ones `shown` says fall
 * outside the window, each at the `fade` a thin one draws at.
 */
export function drawnColors(
  geometry:
    | {
        instanceCount: number
        instanceFeatureIdx: ArrayLike<number>
        colors: ArrayLike<number>
      }
    | undefined,
  level: number,
  nameOf: (feature: number) => string,
  shown: (instance: number) => boolean = () => true,
  fade: (instance: number) => number = () => 1,
) {
  const out: Record<string, [string, number][]> = {}
  for (let i = 0; i < (geometry?.instanceCount ?? 0); i++) {
    const packed = geometry?.colors[i] ?? 0
    if (!isInstanceInvisible(packed, level) && shown(i)) {
      const { color, alpha } = unpack(packed)
      const name = nameOf(geometry?.instanceFeatureIdx[i] ?? 0)
      out[name] = [
        ...(out[name] ?? []),
        [color, rounded(alpha * level * fade(i))],
      ]
    }
  }
  return out
}

/** The export's marks, a row each, grouped as `drawnColors` groups the view's. */
export function exportedColors(
  marks: { alignment: number[]; color: string[]; alpha: number[] },
  nameOf: (alignment: number) => string,
) {
  const out: Record<string, [string, number][]> = {}
  marks.alignment.forEach((alignment, i) => {
    const name = nameOf(alignment)
    out[name] = [
      ...(out[name] ?? []),
      [marks.color[i] ?? '', rounded(marks.alpha[i] ?? 0)],
    ]
  })
  return out
}

/**
 * The view's key as a host draws it: the heading of a key that has rows,
 * each chip in the color it composites to, and the ramps.
 */
export function viewKey(scales: Parameters<typeof colorKeyTables>[0]) {
  const { legend, ramps } = colorKeyTables(scales)
  const chips = legend.label.map((label, i) => ({
    label,
    color: legend.color[i],
  }))
  return {
    title: chips.length + ramps.length > 0 ? (scales[0]?.title ?? '') : '',
    chips,
    ramps,
  }
}

/**
 * The export's key as a host draws it: each chip composited by its
 * `legendAlpha` over the band's ground, as the export's doc tells a host to.
 */
export function exportKey(t: {
  legend: { label: string[]; color: string[] }
  legendTitle: string
  legendAlpha: number
  ramps: ReturnType<typeof rampKeyOf>[]
}) {
  const chips = t.legend.label.map((label, i) => ({
    label,
    color: cssColorToHex(
      blendOverGround(
        t.legend.color[i] ?? '',
        t.legendAlpha,
        bandGroundColor(),
      ),
    ),
  }))
  return {
    title: chips.length + t.ramps.length > 0 ? t.legendTitle : '',
    chips,
    ramps: t.ramps,
  }
}
