import { readConfObject } from '@jbrowse/core/configuration'
import { rampKeyOf } from '@jbrowse/core/ui/rampKey'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import {
  abgrAlpha,
  abgrToHex,
  cssColorToHex,
} from '@jbrowse/core/util/colorBits'
import { colorSnapshotOf } from '@jbrowse/display-kit/colorConfigSchema'

import { orderAttributeLabels } from './TrackColorsMixin.ts'
import {
  colorByScales,
  colorByShortLabel,
  getColorBySwatch,
} from './colorLegend.ts'
import { colorPaintOf, isAttributeLabels } from './colorRamps.ts'
import { opacityFadeOf, opacityLevel } from './opacityChannel.ts'
import { adapterAssemblyNames } from './regionsInAssemblyNamespace.ts'
import { paintedField } from './syntenyColorBy.ts'
import { syntenyColorConfigSchema } from './syntenyColorConfigSchema.ts'
import { syntenyTrackPalette } from './trackColors.ts'

import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'
import type { SyntenyOpacitySnapshot } from './syntenyOpacityConfigSchema.ts'
import type { Region } from '@jbrowse/core/util'

// What the synteny and dotplot tables share: an axis as a host describes it,
// the view's color and opacity settings read off their config objects, a
// fetch's per-feature channels as table columns, and the key the view shows.

export interface AxisRegionArgs {
  refName: string
  start: number
  end: number
  reversed?: boolean
}

/**
 * One axis of a comparative view as a host writes it: the regions it shows,
 * end to end, the assembly they are on (unset, the adapter's own name for
 * that side), the pixels it draws them across, which sets the zoom, and the
 * assembly's contigs in order, which hand out the palette a color by contig
 * name paints (unset, the regions' own order).
 */
export interface AxisArgs {
  regions: AxisRegionArgs[]
  assemblyName?: string
  width: number
  refNames?: string[]
}

export interface ComparativeAxis {
  regions: Region[]
  refNames: string[]
  bpPerPx: number
  assemblyName: string
  /** cumulative bp before each region, no padding, as the views lay them out */
  before: number[]
}

/** `AxisArgs` resolved against the adapter: side 0 is the adapter's query, 1 its target. */
export function comparativeAxis(
  axis: AxisArgs,
  adapterConfig: Record<string, unknown>,
  side: 0 | 1,
): ComparativeAxis {
  const names = adapterAssemblyNames(adapterConfig)
  const assemblyName = axis.assemblyName ?? names[side] ?? names[0] ?? ''
  const regions = axis.regions.map(r => ({ ...r, assemblyName }))
  const before: number[] = []
  let total = 0
  for (const r of regions) {
    before.push(total)
    total += r.end - r.start
  }
  return {
    regions,
    refNames: axis.refNames ?? [...new Set(regions.map(r => r.refName))],
    assemblyName,
    before,
    bpPerPx: total / Math.max(1, axis.width),
  }
}

/**
 * A cumulative-bp coordinate back on its region: the index of the region it
 * falls in and the genomic coordinate there. `hint` is another coordinate of
 * the same shape, which settles a point on the seam between two regions.
 */
export function locateCum(axis: ComparativeAxis, cum: number, hint = cum) {
  const { regions, before } = axis
  const mid = (cum + hint) / 2
  let i = 0
  for (let k = 0; k < regions.length; k++) {
    const r = regions[k]!
    if (mid >= before[k]! && mid <= before[k]! + (r.end - r.start)) {
      i = k
      break
    }
  }
  const r = regions[i]!
  const off = Math.min(Math.max(cum - before[i]!, 0), r.end - r.start)
  return { region: i, coord: r.reversed ? r.end - off : r.start + off }
}

/** The order `query` and `target` painting hand the palette out in: the axis's contigs'. */
export function axisNamePosition(axis: ComparativeAxis) {
  const position = new Map(axis.refNames.map((name, i) => [name, i]))
  return (refName: string) => position.get(refName)
}

export type ColorArg = string | Record<string, unknown> | undefined
export type OpacityArg = number | SyntenyOpacitySnapshot | undefined

export interface ViewColorSettings {
  field: string
  valueColor?: string
  paint: SyntenyColorPaint
  labels?: readonly string[]
  title?: string
  descending?: boolean
  trackColor: string
  opacity: SyntenyOpacitySnapshot
  fade?: SyntenyOpacitySnapshot
  level: number
  attributeRanges: Record<string, AttributeRange>
}

/**
 * The view's `color` and `opacity` as the color pass reads them: the field
 * painted (`reference` resolved to the query side, as a two-row view does),
 * the constant under it, the ramp or label settings, the opacity level every
 * alignment draws at and the fade a field applies under it.
 */
export function viewColorSettings({
  color,
  opacity,
  defaultOpacity,
  attributeRanges,
}: {
  color: ColorArg
  opacity: OpacityArg
  defaultOpacity: number
  attributeRanges: Record<string, AttributeRange>
}): ViewColorSettings {
  const colorSnap = typeof color === 'string' ? { value: color } : (color ?? {})
  const conf = syntenyColorConfigSchema.create(colorSnap)
  const setting = colorSnapshotOf(conf)
  const descending: boolean | undefined = readConfObject(conf, 'descending')
  const field0 = paintedField(setting)
  const field = field0 === 'reference' ? 'query' : field0
  const opacitySnap: SyntenyOpacitySnapshot =
    typeof opacity === 'number' ? { value: opacity } : (opacity ?? {})
  const ordered = orderAttributeLabels(
    attributeRanges,
    setting.domain,
    setting.range,
  )
  return {
    field,
    valueColor: setting.value,
    paint: colorPaintOf(conf),
    labels: setting.labels,
    title: setting.title,
    descending,
    trackColor: syntenyTrackPalette[0]!,
    opacity: opacitySnap,
    fade: opacityFadeOf(opacitySnap),
    level: opacityLevel(opacitySnap, defaultOpacity, ordered),
    attributeRanges: ordered,
  }
}

/**
 * The per-feature channels a fetch carried, as columns: a number channel as
 * its numbers (NaN where a feature has none), a text column as its labels.
 * `mappingQual` is written as `mapq`, the name the view paints it under.
 */
export function attributeColumns(
  attributes: Record<string, Float32Array>,
  attributeRanges: Record<string, AttributeRange>,
) {
  const out: Record<string, (number | string | null)[]> = {}
  for (const [name, range] of Object.entries(attributeRanges)) {
    const values = attributes[name]
    if (!values) {
      continue
    }
    const key = name === 'mappingQual' ? 'mapq' : name
    out[key] = isAttributeLabels(range)
      ? Array.from(values, v => (Number.isNaN(v) ? null : range.labels[v]!))
      : Array.from(values, v => (Number.isNaN(v) ? null : v))
  }
  return out
}

/** A packed ABGR color as `#rrggbb`, and its own alpha, 0 to 1. */
export function unpack(abgr: number) {
  return { color: abgrToHex(abgr), alpha: abgrAlpha(abgr) / 255 }
}

/**
 * The key the view shows for its color field: the chips the legend lists,
 * each in the color its alignments paint before the band's opacity, and a
 * ramp's bar as `ramps` (`rampKeyOf`), its no-value row a chip. A host
 * composites the chips as it composites the ribbons.
 */
export function comparativeLegend(
  settings: ViewColorSettings,
  {
    pointBased = false,
    cigarOps,
  }: { pointBased?: boolean; cigarOps?: number } = {},
) {
  const opts = {
    pointBased,
    cigarOps,
    attributeRanges: settings.attributeRanges,
    paint: settings.paint,
    labels: settings.labels,
    descending: settings.descending,
  }
  const swatch = getColorBySwatch(settings.field, opts)
  const title = settings.title ?? colorByShortLabel(settings.field)
  const chips =
    swatch?.kind === 'chips'
      ? swatch.chips.flatMap(c =>
          c.color === undefined
            ? []
            : [{ label: c.label, color: cssColorToHex(c.color) }],
        )
      : swatch?.missingColor === undefined
        ? []
        : [{ label: NO_VALUE_LABEL, color: cssColorToHex(swatch.missingColor) }]
  return {
    legend: {
      label: chips.map(c => c.label),
      color: chips.map(c => c.color),
    },
    legendTitle: title,
    ramps: colorByScales(settings.field, { ...opts, title })
      .filter(scale => scale.kind === 'ramp')
      .map(rampKeyOf),
  }
}
