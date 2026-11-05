import { fullConfSnapshot } from '@jbrowse/core/configuration'
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
  colorKeyOptions,
  colorByShortLabel,
  getColorBySwatch,
} from './colorLegend.ts'
import { colorPaintOf, hasColorKey, isAttributeLabels } from './colorRamps.ts'
import { opacityFadeOf, opacityLevel } from './opacityChannel.ts'
import { adapterAssemblyNames } from './regionsInAssemblyNamespace.ts'
import { paintedField } from './syntenyColorBy.ts'
import { syntenyColorConfigSchema } from './syntenyColorConfigSchema.ts'
import { syntenyOpacityConfigSchema } from './syntenyOpacityConfigSchema.ts'
import { syntenyTrackPalette } from './trackColors.ts'

import type { RefNamePosition } from './colorFunctions.ts'
import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'
import type { SyntenyOpacitySnapshot } from './syntenyOpacityConfigSchema.ts'
import type { Region } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

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
 * order a color by contig name hands its palette out in: `refNamePosition`,
 * the axis's assembly's own (`Assembly.getRefNamePosition`), else the
 * contigs of `refNames` in order, else the regions'.
 */
export interface AxisArgs {
  regions: AxisRegionArgs[]
  assemblyName?: string
  width: number
  refNames?: string[]
  refNamePosition?: RefNamePosition
}

export interface ComparativeAxis {
  regions: Region[]
  refNames: string[]
  refNamePosition?: RefNamePosition
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
    refNamePosition: axis.refNamePosition,
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

/** The order `query` and `target` painting hand the palette out in: the axis's assembly's, else its contigs'. */
export function axisNamePosition(axis: ComparativeAxis) {
  return axis.refNamePosition ?? positionIn(axis.refNames)
}

function positionIn(refNames: readonly string[]) {
  const position = new Map(refNames.map((name, i) => [name, i]))
  return (refName: string) => position.get(refName)
}

/**
 * The `RefNamePosition` a chromosome-painting field hands its palette out by,
 * as `refNamePositionFor` reads it off two axes a host laid out: `query`
 * reads the first axis's contigs, `target` the second's.
 */
export function axesNamePositionFor(
  field: string | undefined,
  [query, target]: readonly [ComparativeAxis, ComparativeAxis],
) {
  return field === 'query'
    ? axisNamePosition(query)
    : field === 'target'
      ? axisNamePosition(target)
      : undefined
}

export type ColorArg = string | Record<string, unknown> | undefined
export type OpacityArg = number | SyntenyOpacitySnapshot | undefined
export type FilterArg = readonly FieldPredicate[] | undefined

export interface ViewColorSettings {
  field: string | undefined
  valueColor?: string
  paint: SyntenyColorPaint
  names?: readonly string[]
  title?: string
  descending?: boolean
  trackColor: string
  opacity: SyntenyOpacitySnapshot
  fade?: SyntenyOpacitySnapshot
  level: number
  attributeRanges: Record<string, AttributeRange>
  /** `encoding.color` and `encoding.opacity` as config objects, every slot filled, `value` the view's default opacity where unset */
  config: {
    encoding: {
      color: Record<string, unknown>
      opacity: Record<string, unknown>
    }
  }
}

/**
 * The view's `encoding.color` and `encoding.opacity` as the color pass reads
 * them: the field painted (`reference` resolved to the query side, as a two-row view does),
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
  const conf = syntenyColorConfigSchema.create(
    typeof color === 'string' ? { field: color } : (color ?? {}),
  )
  const setting = colorSnapshotOf(conf)
  const field0 = paintedField(setting)
  const field = field0 === 'reference' ? 'query' : field0
  const opacitySnap: SyntenyOpacitySnapshot =
    typeof opacity === 'number' ? { value: opacity } : (opacity ?? {})
  const ordered = orderAttributeLabels(
    attributeRanges,
    setting.scale.domain,
    setting.scale.range,
  )
  return {
    field,
    valueColor: setting.value,
    paint: colorPaintOf(conf),
    names: setting.scale.names,
    title: setting.legend.title,
    descending: setting.legend.descending,
    trackColor: syntenyTrackPalette[0]!,
    opacity: opacitySnap,
    fade: opacityFadeOf(opacitySnap),
    level: opacityLevel(opacitySnap, defaultOpacity, ordered),
    attributeRanges: ordered,
    config: {
      encoding: {
        color: fullConfSnapshot(conf),
        opacity: fullConfSnapshot(
          syntenyOpacityConfigSchema.create({
            ...opacitySnap,
            value: opacitySnap.value ?? defaultOpacity,
          }),
        ),
      },
    },
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
    filter,
    pointBased = false,
    cigarOps,
    trackName,
  }: {
    filter: readonly FieldPredicate[]
    pointBased?: boolean
    cigarOps?: number
    trackName?: string
  },
) {
  const keyed = hasColorKey(settings.field)
  const opts = {
    ...colorKeyOptions({
      field: settings.field,
      filter,
      paint: settings.paint,
      attributeRanges: settings.attributeRanges,
      names: settings.names,
      descending: settings.descending,
    }),
    pointBased,
    cigarOps,
    trackChips:
      trackName === undefined
        ? undefined
        : [{ label: trackName, color: settings.trackColor }],
  }
  const swatch = keyed ? getColorBySwatch(settings.field, opts) : undefined
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
    ramps: keyed
      ? colorByScales(settings.field, { ...opts, title })
          .filter(scale => scale.kind === 'ramp')
          .map(rampKeyOf)
      : [],
  }
}
