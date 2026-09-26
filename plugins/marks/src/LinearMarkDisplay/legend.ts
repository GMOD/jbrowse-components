import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { DEFAULT_COLOR_SCHEME } from '@jbrowse/core/util/colorSchemes'
import {
  derivedColorScale,
  everyRowPaints,
} from '@jbrowse/core/util/legendCandidates'
import { rampMidNorm, rampOverExtent } from '@jbrowse/core/util/markEncoding'
import {
  rampGapScales,
  thresholdKeyEntries,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type {
  CategoricalEntry,
  CategoricalScale,
  ColorScale,
} from '@jbrowse/core/ui/colorScale'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type {
  ShapeName,
  ShapeScaleTable,
  ScaleTable,
} from '@jbrowse/core/util/markEncoding'

const RAMP_STOPS = 8

// Values past which a numeric field drawn as categories has stopped being a
// vocabulary. A numeric field genuinely used as one — a rank, a copy number, a
// tier — has a handful of values; past eight the author meant a colour scale,
// and the hint stands in for the key where `legendIsReadable` drops it.
const NUMERIC_KEY_HINT_ROWS = 8

const NUMERIC_KEY_HINT =
  "numeric values drawn as categories; set scale: 'linear' for a color scale"

export type ScaledChannel = 'color' | 'shape'

/**
 * What a mark's channel says of its key beyond the table the worker resolved,
 * as ggplot2's scale arguments do: the heading, which values it lists and in
 * what order, what it calls a value's absence, and for a shape the name of
 * each domain value and the one colour its mark paints, which ggplot2 draws a
 * layer's key glyphs in. A colour's `labels` ride in the table instead.
 */
export interface MarkKeySetting {
  title?: string
  labels?: readonly string[]
  breaks?: readonly string[]
  descending?: boolean
  missingLabel?: string
  swatchColor?: string
}

/**
 * One scaled channel's key: the table the worker resolved, the marks it is
 * the key of, and its heading. Marks whose channel reads one field through
 * one declaration under one title share a section, the way ggplot2 keeps one
 * scale per aesthetic across layers and merges only guides titled alike. A
 * ramp with an open end is each mark's own, its domain following that mark's
 * loaded values; pinned at both ends it is its declaration, shared like the
 * rest.
 */
export interface MarkLegendSection {
  markIndexes: number[]
  channel: ScaledChannel
  scale: ScaleTable
  /** The channel's `title` where written, else the field; `''` heads nothing. */
  title: string
  key: MarkKeySetting
}

const CHANNELS: {
  channel: ScaledChannel
  tableOf: (layer: StoredLayer) => ScaleTable | undefined
}[] = [
  { channel: 'color', tableOf: l => l.scale },
  { channel: 'shape', tableOf: l => l.shapeScale },
]

function copyOf(scale: ScaleTable): ScaleTable {
  switch (scale.kind) {
    case 'ramp':
      return {
        ...scale,
        domain: [scale.domain[0], scale.domain[1]],
        extent: [scale.extent[0], scale.extent[1]],
      }
    case 'categorical':
      return { ...scale, entries: [...scale.entries] }
    case 'shape':
      return { ...scale, entries: [...scale.entries] }
    case 'threshold':
      return { ...scale }
  }
}

function fullyPinned(scale: Extract<ScaleTable, { kind: 'ramp' }>) {
  return scale.pinned[0] && scale.pinned[1]
}

function unionEntries<E extends { value: string }>(
  into: E[],
  from: readonly E[],
) {
  const seen = new Set(into.map(e => e.value))
  for (const entry of from) {
    if (!seen.has(entry.value)) {
      seen.add(entry.value)
      into.push(entry)
    }
  }
}

function union(current: ScaleTable, next: ScaleTable) {
  switch (current.kind) {
    case 'categorical':
      if (next.kind === 'categorical') {
        unionEntries(current.entries, next.entries)
        current.numericKeys = current.numericKeys && next.numericKeys
      }
      break
    case 'shape':
      if (next.kind === 'shape') {
        unionEntries(current.entries, next.entries)
      }
      break
    case 'threshold':
      if (next.kind === 'threshold') {
        current.missing = current.missing || next.missing
        current.notNumber = current.notNumber || next.notNumber
      }
      break
    case 'ramp':
      // A ramp's open ends are the union of the regions' extremes, which is
      // the same number the shaders read as a uniform, so the key and the
      // painting cannot disagree across a pan. A pinned end already agrees,
      // and the union still says whether the data runs past it.
      if (next.kind === 'ramp') {
        current.extent = [
          Math.min(current.extent[0], next.extent[0]),
          Math.max(current.extent[1], next.extent[1]),
        ]
        current.missing = current.missing || next.missing
        current.notNumber = current.notNumber || next.notNumber
      }
      break
  }
}

// What a section is keyed on: the declaration that assigns a value its colour
// or shape, and the key settings over it, so two marks sharing both share the
// key. A ramp with an open end stays the mark's, its domain being the uniform
// that mark's shaders read off its own loaded values.
function sectionKey(markIndex: number, scale: ScaleTable, key: MarkKeySetting) {
  const title = JSON.stringify({ ...key, title: key.title ?? scale.field })
  switch (scale.kind) {
    case 'ramp':
      return fullyPinned(scale)
        ? JSON.stringify([
            'ramp',
            scale.field,
            title,
            scale.scale,
            scale.domain,
            scale.domainMid ?? null,
            scale.range ?? scale.scheme ?? DEFAULT_COLOR_SCHEME,
            scale.reverse ?? false,
          ])
        : JSON.stringify(['ramp', markIndex])
    case 'categorical':
      return JSON.stringify([
        'categorical',
        scale.field,
        title,
        scale.domain,
        scale.range ?? [],
      ])
    case 'threshold':
      return JSON.stringify([
        'threshold',
        scale.field,
        title,
        scale.domain,
        thresholdPalette(scale.domain.length + 1, scale.range),
      ])
    case 'shape':
      return JSON.stringify([
        'shape',
        scale.field,
        title,
        scale.domain,
        scale.range ?? [],
      ])
  }
}

/**
 * The keys the loaded regions carry, one per scale, in the order of the first
 * mark drawing through each with colour before shape. A categorical or
 * threshold table is the union over regions and over the marks declaring it
 * alike, in the field's order; a key's entry is the same in every region. A
 * ramp's domain takes each pinned end as the config wrote it and each open one
 * from the union of the regions' own extremes — the same number the shaders
 * read as a uniform. A key is headed with the `title` `keyOf` answers for its
 * mark and channel, and with its field otherwise.
 */
export function buildMarkLegend(
  regions: Iterable<MarkRegionData>,
  showsMark: (markIndex: number) => boolean = () => true,
  keyOf: (
    markIndex: number,
    channel: ScaledChannel,
  ) => MarkKeySetting = () => ({}),
): MarkLegendSection[] {
  const sections = new Map<string, MarkLegendSection>()
  for (const region of regions) {
    region.layers.forEach((layer, markIndex) => {
      if (!showsMark(markIndex)) {
        return
      }
      for (const { channel, tableOf } of CHANNELS) {
        const scale = tableOf(layer)
        if (!scale) {
          continue
        }
        const key = keyOf(markIndex, channel)
        const id = sectionKey(markIndex, scale, key)
        const current = sections.get(id)
        if (!current) {
          sections.set(id, {
            markIndexes: [markIndex],
            channel,
            scale: copyOf(scale),
            title: key.title ?? scale.field,
            key,
          })
        } else {
          if (!current.markIndexes.includes(markIndex)) {
            current.markIndexes.push(markIndex)
          }
          union(current.scale, scale)
        }
      }
    })
  }
  for (const section of sections.values()) {
    const { scale } = section
    if (scale.kind === 'ramp' && !fullyPinned(scale)) {
      section.scale = rampOverExtent(scale, scale.extent)
    }
  }
  return [...sections.values()].sort(
    (a, b) =>
      a.markIndexes[0]! - b.markIndexes[0]! ||
      CHANNELS.findIndex(c => c.channel === a.channel) -
        CHANNELS.findIndex(c => c.channel === b.channel),
  )
}

// A shape table over the same field a categorical colour reads, on marks
// that colour also keys: the two keys would list the same values twice, so
// the colour key draws the shape as its swatch, under the colour's title, and
// the shape key is folded away.
function shapeOverSameField(
  sections: MarkLegendSection[],
  colour: MarkLegendSection,
) {
  const field = colour.scale.kind === 'categorical' && colour.scale.field
  const shape = sections.find(
    s =>
      s.channel === 'shape' &&
      s.scale.kind === 'shape' &&
      s.scale.field === field &&
      s.markIndexes.every(i => colour.markIndexes.includes(i)),
  )
  return shape?.scale.kind === 'shape' ? shape : undefined
}

// A key over the facet's own field lists its rows in the sections' order, so
// the key and the chips read top to bottom alike.
function keyField(
  scale: { field: string; domain: string[]; labels?: string[] },
  facet: CategoricalField | undefined,
) {
  const own = categoricalField(scale.field, {
    domain: scale.domain,
    labels: scale.labels,
  })
  return facet?.field === scale.field ? { ...facet, label: own.label } : own
}

// A key's rows as its channel lists them: only the values `breaks` names, in
// its order, where it names any, and the no-value row under `missingLabel`.
function listedRows(
  entries: CategoricalEntry[],
  { breaks = [], missingLabel }: MarkKeySetting,
) {
  const rows =
    breaks.length === 0
      ? entries
      : [
          ...new Set(
            breaks.flatMap(value =>
              entries.filter(e => (e.values ?? [e.value]).includes(value)),
            ),
          ),
        ]
  return missingLabel === undefined
    ? rows
    : rows.map(e => (e.missing ? { ...e, label: missingLabel } : e))
}

function listedKey(scale: CategoricalScale, key: MarkKeySetting) {
  const { breaks = [] } = key
  return {
    ...scale,
    entries: listedRows(scale.entries, key),
    ...(breaks.length > 0 ? { domain: breaks } : {}),
  }
}

function shapeKey(
  id: string,
  title: string | undefined,
  scale: ShapeScaleTable,
  facet: CategoricalField | undefined,
  key: MarkKeySetting,
): CategoricalScale {
  const field = keyField({ ...scale, labels: [...(key.labels ?? [])] }, facet)
  return listedKey(
    {
      kind: 'categorical',
      id,
      title,
      entries: scale.entries
        .toSorted((a, b) => field.compare(a.value, b.value))
        .map(e => ({
          value: e.value,
          label: field.label(e.value),
          swatches: [
            { color: key.swatchColor ?? 'currentColor', shape: e.shape },
          ],
          ...(e.value === '' ? { missing: true } : {}),
        })),
    },
    key,
  )
}

// A threshold's rows, its intervals from the highest where the key descends;
// the rows for no value and not a number stay last either way.
function thresholdRows(
  scale: Extract<ScaleTable, { kind: 'threshold' }>,
  { descending, missingLabel }: MarkKeySetting,
) {
  const rows = thresholdKeyEntries(
    scale.domain,
    scale.range,
    scale,
    scale.labels,
  )
  const intervals = scale.domain.length + 1
  return listedRows(
    descending
      ? [...rows.slice(0, intervals).reverse(), ...rows.slice(intervals)]
      : rows,
    { missingLabel },
  )
}

// A colour row names every value painted in its colour, so it draws each
// shape those values take, in the colour.
function shapeSwatches(shape: ShapeScaleTable) {
  const shapeOf = new Map(shape.entries.map(e => [e.value, e.shape]))
  return ({
    value,
    values = [value],
    color,
  }: CategoricalEntry & { color: string }) => {
    const shapes = [...new Set(values.flatMap(v => shapeOf.get(v) ?? []))]
    return shapes.length > 0
      ? shapes.map(shape => ({ color, shape }))
      : [{ color }]
  }
}

/**
 * The keys as the color scales `LegendMixin` derives the legend from. A
 * categorical colour's key is the one every colour channel derives
 * (`derivedColorScale`), a row per colour. A shape table is a categorical
 * scale whose swatches are the shapes, drawn in the one colour its mark
 * paints, or in the text colour where that colour is a scale, which the shape
 * key does not describe — unless the colour key is over the same field, when
 * it carries both, each swatch a value's shape in its colour.
 */
export function markColorScales(
  sections: MarkLegendSection[],
  facet?: CategoricalField,
): ColorScale[] {
  const folded = new Set<MarkLegendSection>()
  return sections.flatMap((section): ColorScale[] => {
    if (folded.has(section)) {
      return []
    }
    const { markIndexes, channel, scale, key } = section
    const id = `mark-${markIndexes.join('-')}-${channel}`
    const title = section.title || undefined
    switch (scale.kind) {
      case 'categorical': {
        const shape = shapeOverSameField(sections, section)
        const keys = derivedColorScale([scale.entries], everyRowPaints, {
          id,
          field: keyField(scale, facet),
          title: section.title,
          swatches:
            shape?.scale.kind === 'shape'
              ? shapeSwatches(shape.scale)
              : undefined,
        })
        if (shape && keys.length > 0) {
          folded.add(shape)
        }
        const breaks = key.breaks ?? []
        const listed =
          breaks.length === 0
            ? scale.entries
            : scale.entries.filter(e => breaks.includes(e.value))
        const hinted =
          scale.numericKeys && listed.length > NUMERIC_KEY_HINT_ROWS
        if (!hinted) {
          return keys.map(k => listedKey(k, key))
        }
        return keys.length > 0
          ? keys.map(k => ({ ...listedKey(k, key), note: NUMERIC_KEY_HINT }))
          : [
              {
                kind: 'categorical',
                id,
                title,
                entries: [{ value: '', label: NUMERIC_KEY_HINT }],
              },
            ]
      }
      case 'shape':
        return [shapeKey(id, title, scale, facet, key)]
      case 'threshold':
        return [
          {
            kind: 'categorical',
            id,
            title,
            entries: thresholdRows(scale, key),
          },
        ]
      case 'ramp':
        return [
          {
            kind: 'ramp',
            id,
            title,
            domain: scale.domain,
            stops: stopsFromRampLut(
              scale.lut,
              RAMP_STOPS,
              rampMidNorm(scale.scale, scale.domain, scale.domainMid),
            ),
            extent: scale.extent,
          },
          ...rampGapScales(`${id}-gaps`, scale).map(gaps => ({
            ...gaps,
            entries: listedRows(gaps.entries, {
              missingLabel: key.missingLabel,
            }),
          })),
        ]
    }
  })
}

/** The colour key of one mark, if its colour is a scale. */
export function colorSection(sections: MarkLegendSection[], markIndex: number) {
  return sections.find(
    s => s.channel === 'color' && s.markIndexes.includes(markIndex),
  )?.scale
}

/** The shape key of one mark, if its shape is a scale. */
export function shapeSection(sections: MarkLegendSection[], markIndex: number) {
  return sections.find(
    s => s.channel === 'shape' && s.markIndexes.includes(markIndex),
  )?.scale
}

/**
 * The categories a shape names in a shape table: three shapes over any number
 * of values, so a shape the range handed out twice names both, the way a key
 * derived from the painting lists every value drawn in one colour.
 */
export function shapeLabel(scale: ScaleTable | undefined, shape: ShapeName) {
  if (scale?.kind !== 'shape') {
    return undefined
  }
  const field = categoricalField(scale.field)
  const values = scale.entries
    .filter(e => e.shape === shape)
    .map(e => field.label(e.value))
  return values.length > 0 ? values.join(', ') : undefined
}

/**
 * The interval or categories a packed colour names, if its table has any. An
 * instance carries its colour and not its value, so two values hashed onto one
 * palette entry are both named, as {@link shapeLabel} names a shared shape; a
 * threshold's rows are read back off its palette and its two greys.
 */
export function categoryLabel(scale: ScaleTable | undefined, color: number) {
  if (scale?.kind === 'threshold') {
    return thresholdKeyEntries(
      scale.domain,
      scale.range,
      scale,
      scale.labels,
    ).find(e => cssColorToABGR(e.color) === color)?.label
  }
  if (scale?.kind !== 'categorical') {
    return undefined
  }
  const { label } = categoricalField(scale.field, {
    domain: scale.domain,
    labels: scale.labels,
  })
  const values = scale.entries
    .filter(e => e.color === color)
    .map(e => label(e.value))
  return values.length > 0 ? values.join(', ') : undefined
}
