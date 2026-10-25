import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { IDENTITY_SCALE } from '@jbrowse/core/util/colorScale'
import { DEFAULT_COLOR_SCHEME } from '@jbrowse/core/util/colorSchemes'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  derivedColorScale,
  everyRowPaints,
} from '@jbrowse/core/util/legendCandidates'
import {
  DEFAULT_MARK_COLOR,
  rampOverExtent,
} from '@jbrowse/core/util/markEncoding'
import {
  rampGapScales,
  thresholdKeyEntries,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import {
  FEATURE_FIELD_PRESETS,
  colorSettingOf,
  colorSnapshotOf,
  featureColorEncoding,
  withPreset,
} from '@jbrowse/display-kit/colorConfigSchema'
import { thresholdBandOf } from '@jbrowse/render-core/marks'
import { rampMidNorm, scaleTypeCode } from '@jbrowse/render-core/scoreScale'

import { paintedColorNode } from './inheritedColor.ts'

import type { MarkConfig } from './configSchema.ts'
import type { MarkColorConfig } from './inheritedColor.ts'
import type { HiddenCategory } from './markColor.ts'
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
import type { MarkColorScale } from '@jbrowse/render-core/marks'

const RAMP_STOPS = 8

/**
 * The one color a mark paints every instance: the default blue where none is
 * written, here or in `inherited`, and none under a jexl callback or a scale.
 */
export function constantColorOf(
  mark: MarkConfig,
  inherited?: MarkColorConfig,
): string | undefined {
  const encoding = featureColorEncoding(
    colorSettingOf(paintedColorNode(mark, inherited)),
  )
  return encoding === undefined
    ? DEFAULT_MARK_COLOR
    : typeof encoding === 'string' && !isJexl(encoding)
      ? encoding
      : undefined
}

/**
 * What a mark's channel says of its key: its guide members, copied out of the
 * config so a section holds plain values, and for a color the values of its
 * field that `hidden` names.
 */
export function keySettingOf(
  mark: MarkConfig | undefined,
  channel: ScaledChannel,
  hidden: readonly HiddenCategory[] = [],
  inherited?: MarkColorConfig,
): MarkKeySetting {
  if (!mark) {
    return {}
  }
  if (channel === 'color') {
    const color = paintedColorNode(mark, inherited)
    const { field, scale, legend } = withPreset(
      colorSnapshotOf(color),
      FEATURE_FIELD_PRESETS,
    )
    const keyField = scale.type === IDENTITY_SCALE ? '' : field
    const hiddenValues = hidden
      .filter(h => h.field === keyField)
      .map(h => h.value)
    return {
      title: legend.title,
      names: [...(scale.names ?? [])],
      values: [...color.legend.values],
      descending: legend.descending,
      missingLabel: color.legend.missingLabel,
      unknown: scale.unknown,
      invalid: scale.invalid,
      ...(hiddenValues.length > 0 ? { hidden: hiddenValues } : {}),
    }
  }
  const { scale, legend } = mark.encoding.shape
  const swatchColor = constantColorOf(mark, inherited)
  return {
    title: legend.title,
    names: [...scale.names],
    values: [...legend.values],
    missingLabel: legend.missingLabel,
    ...(swatchColor === undefined ? {} : { swatchColor }),
  }
}

// Values past which a numeric field drawn as categories has stopped being a
// vocabulary. A numeric field genuinely used as one — a rank, a copy number, a
// tier — has a handful of values; past eight the author meant a color scale.
const NUMERIC_KEY_HINT_ROWS = 8

const NUMERIC_KEY_HINT =
  "numeric values drawn as categories; set scale.type: 'linear' for a color scale"

export type ScaledChannel = 'color' | 'shape'

/**
 * What a mark's channel says of its key beyond the table the worker resolved,
 * as ggplot2's scale arguments do: the heading, the name of each domain value
 * or threshold interval, which values it lists and in what order, what it
 * calls a value's absence, and for a shape the one color its mark paints,
 * which ggplot2 draws a layer's key glyphs in. All of it is the config's, so
 * renaming a key row refetches nothing.
 */
export interface MarkKeySetting {
  title?: string
  names?: readonly string[]
  values?: readonly string[]
  descending?: boolean
  missingLabel?: string
  swatchColor?: string
  /** The color `unknown` paints the values the domain leaves out, one row named Other. */
  unknown?: string
  /** The color `invalid` paints a feature with no value */
  invalid?: string
  /** The values the Categories menu hides, which the key strikes through. */
  hidden?: readonly string[]
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
  // a region still holding an earlier declaration's data adds no color key:
  // its table is its own, not the mark's. Shape resolves in the worker and has
  // no such hold, so a region not yet refetched keys its old field's shapes.
  { channel: 'color', tableOf: l => (l.heldColor ? undefined : l.scale) },
  { channel: 'shape', tableOf: l => l.shapeScale },
]

function copyOf(scale: ScaleTable): ScaleTable {
  switch (scale.kind) {
    case 'ramp':
      return {
        ...scale,
        domain: [scale.domain[0], scale.domain[1]],
        extent: [scale.extent[0], scale.extent[1]],
        ...(scale.extremes
          ? { extremes: [scale.extremes[0], scale.extremes[1]] }
          : {}),
      }
    case 'categorical':
    case 'identity':
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
    case 'identity':
      if (next.kind === 'identity') {
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
        if (current.extremes || next.extremes) {
          const a = current.extremes ?? current.extent
          const b = next.extremes ?? next.extent
          current.extremes = [Math.min(a[0], b[0]), Math.max(a[1], b[1])]
        }
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

// What a section is keyed on: the declaration that assigns a value its color
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
    case 'identity':
      return JSON.stringify(['identity', title, scale.domain])
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
 * mark drawing through each with color before shape. A categorical or
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

// A shape table over the same field an ordinal color reads, on marks
// that color also keys: the two keys would list the same values twice, so
// the color key draws the shape as its swatch, under the color's title, and
// the shape key is folded away.
function shapeOverSameField(
  sections: MarkLegendSection[],
  color: MarkLegendSection,
) {
  const field = color.scale.kind === 'categorical' && color.scale.field
  const shape = sections.find(
    s =>
      s.channel === 'shape' &&
      s.scale.kind === 'shape' &&
      s.scale.field === field &&
      s.markIndexes.every(i => color.markIndexes.includes(i)),
  )
  return shape?.scale.kind === 'shape' ? shape : undefined
}

// A key over the facet's own field lists its rows in the sections' order, so
// the key and the chips read top to bottom alike.
function keyField(
  scale: { field: string; domain: string[] },
  key: MarkKeySetting,
  facet: CategoricalField | undefined,
) {
  const own = categoricalField(scale.field, {
    domain: scale.domain,
    labels: key.names,
    unknown: key.unknown,
  })
  return facet?.field === scale.field
    ? { ...facet, label: own.label, unknown: own.unknown }
    : own
}

// A key's rows as its channel lists them: only the values `legend.values` names, in
// its order, where it names any, and the no-value row under `legend.missingLabel`.
function listedRows(
  entries: CategoricalEntry[],
  { values = [], missingLabel }: MarkKeySetting,
) {
  const rows =
    values.length === 0
      ? entries
      : [
          ...new Set(
            values.flatMap(value =>
              entries.filter(e => (e.values ?? [e.value]).includes(value)),
            ),
          ),
        ]
  return missingLabel === undefined
    ? rows
    : rows.map(e => (e.missing ? { ...e, label: missingLabel } : e))
}

function listedKey(scale: CategoricalScale, key: MarkKeySetting) {
  const { values = [] } = key
  return {
    ...scale,
    entries: listedRows(scale.entries, key),
    ...(values.length > 0 ? { domain: values } : {}),
  }
}

function shapeKey(
  id: string,
  title: string | undefined,
  scale: ShapeScaleTable,
  facet: CategoricalField | undefined,
  key: MarkKeySetting,
): CategoricalScale {
  const field = keyField(scale, key, facet)
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
  { names, descending, missingLabel }: MarkKeySetting,
) {
  const rows = thresholdKeyEntries(scale.domain, scale.range, scale, names)
  const intervals = scale.domain.length + 1
  return listedRows(
    descending
      ? [...rows.slice(0, intervals).reverse(), ...rows.slice(intervals)]
      : rows,
    { missingLabel },
  )
}

// A color row names every value painted in its color, so it draws each
// shape those values take, in the color.
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

// An identity key's rows: each `domain` color under its `names` entry, the
// whole list once the region drew any color, as a threshold lists its bins.
function identityRows(
  scale: Extract<ScaleTable, { kind: 'identity' }>,
  key: MarkKeySetting,
): CategoricalEntry[] {
  if (scale.entries.length === 0) {
    return []
  }
  const { label } = categoricalField('', {
    domain: scale.domain,
    labels: key.names,
  })
  return scale.domain.map(color => ({
    value: color,
    label: label(color),
    color,
    ...(key.hidden?.includes(color) ? { hidden: true } : {}),
  }))
}

// A key's rows struck through where every value a row names is hidden.
function withHiddenRows(scale: CategoricalScale, { hidden }: MarkKeySetting) {
  return hidden?.length
    ? {
        ...scale,
        entries: scale.entries.map(e =>
          (e.values ?? [e.value]).every(v => hidden.includes(v))
            ? { ...e, hidden: true }
            : e,
        ),
      }
    : scale
}

/**
 * The keys as the color scales `LegendMixin` derives the legend from. An
 * ordinal color's key is the one every color channel derives
 * (`derivedColorScale`), a row per color. A shape table is an ordinal
 * scale whose swatches are the shapes, drawn in the one color its mark
 * paints, or in the text color where that color is a scale, which the shape
 * key does not describe — unless the color key is over the same field, when
 * it carries both, each swatch a value's shape in its color.
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
          field: keyField(scale, key, facet),
          title: section.title,
          swatches:
            shape?.scale.kind === 'shape'
              ? shapeSwatches(shape.scale)
              : undefined,
        })
        if (shape && keys.length > 0) {
          folded.add(shape)
        }
        const values = key.values ?? []
        const listed =
          values.length === 0
            ? scale.entries
            : scale.entries.filter(e => values.includes(e.value))
        const hinted =
          scale.numericKeys && listed.length > NUMERIC_KEY_HINT_ROWS
        if (!hinted) {
          return keys.map(k => withHiddenRows(listedKey(k, key), key))
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
      case 'identity': {
        const entries = identityRows(scale, key)
        return entries.length > 0
          ? [{ kind: 'categorical', id, title, entries }]
          : []
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
              rampMidNorm(
                scale.domain[0],
                scale.domain[1],
                scaleTypeCode(scale.scale),
                scale.domainMid,
              ),
            ),
            extent: scale.extremes ?? scale.extent,
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

/** The color key of one mark, if its color is a scale. */
export function colorSection(sections: MarkLegendSection[], markIndex: number) {
  return sections.find(
    s => s.channel === 'color' && s.markIndexes.includes(markIndex),
  )
}

/**
 * The scale a mark's shapes paint through, off its color key's table: a ramp
 * over the domain the key unioned across the regions, `domainMid` the value
 * its middle stop sits at, or a threshold's cuts and the packed color of each
 * interval.
 */
export function paintScaleOf(
  table: ScaleTable | undefined,
): MarkColorScale | undefined {
  if (table?.kind === 'ramp') {
    return {
      domain: table.domain,
      scale: table.scale,
      lut: table.lut,
      mid: table.domainMid,
    }
  }
  if (table?.kind === 'threshold') {
    return {
      cuts: table.domain,
      colors: Uint32Array.from(
        thresholdPalette(table.domain.length + 1, table.range),
        c => cssColorToABGR(c),
      ),
    }
  }
  return undefined
}

/**
 * Each of `markCount` marks' paint scale over `regions`, for a display that
 * draws marks but builds no legend: multi-way synteny's lane layers.
 */
export function paintScalesOver(
  regions: Iterable<MarkRegionData>,
  markCount: number,
) {
  const sections = buildMarkLegend(regions)
  return Array.from({ length: markCount }, (_, i) =>
    paintScaleOf(colorSection(sections, i)?.scale),
  )
}

/** The shape key of one mark, if its shape is a scale. */
export function shapeSection(sections: MarkLegendSection[], markIndex: number) {
  return sections.find(
    s => s.channel === 'shape' && s.markIndexes.includes(markIndex),
  )
}

// A value as a hover names it: as the key row does, the no-value row under
// `legend.missingLabel` where written.
function keyLabel(
  scale: { field: string; domain: string[] },
  key: MarkKeySetting,
) {
  const { label } = categoricalField(scale.field, {
    domain: scale.domain,
    labels: key.names,
  })
  const { missingLabel } = key
  return (value: string) =>
    value === '' && missingLabel !== undefined ? missingLabel : label(value)
}

/**
 * The categories a shape names in a shape key, each as the key names it:
 * three shapes over any number of values, so a shape the range handed out
 * twice names both, the way a key derived from the painting lists every value
 * drawn in one color.
 */
export function shapeLabel(
  section: MarkLegendSection | undefined,
  shape: ShapeName,
) {
  if (section?.scale.kind !== 'shape') {
    return undefined
  }
  const { scale, key } = section
  const label = keyLabel(scale, key)
  const values = scale.entries
    .filter(e => e.shape === shape)
    .map(e => label(e.value))
  return values.length > 0 ? values.join(', ') : undefined
}

/**
 * The key row a hovered value falls on, for a ramp or threshold: its
 * interval, or for a NaN the no-value row where `missing` says the feature
 * had none and the not-a-number row otherwise.
 */
export function valueRow(
  section: MarkLegendSection,
  value: number,
  missing = false,
) {
  const { scale, key } = section
  if (scale.kind !== 'ramp' && scale.kind !== 'threshold') {
    return undefined
  }
  if (Number.isNaN(value)) {
    const gaps = listedRows(
      thresholdKeyEntries([], undefined, {
        missing: true,
        notNumber: true,
      }).slice(1),
      { missingLabel: key.missingLabel },
    )
    return gaps.find(e => !!e.missing === missing)
  }
  return scale.kind === 'threshold'
    ? thresholdKeyEntries(scale.domain, scale.range, scale, key.names)[
        thresholdBandOf(value, scale.domain)
      ]
    : undefined
}

/**
 * The interval or categories a packed color names, as its key names them, if
 * its table has any. An instance carries its color and not its value, so two
 * values hashed onto one palette entry are both named, as {@link shapeLabel}
 * names a shared shape; a threshold's rows are read back off its palette and
 * its two greys.
 */
export function categoryLabel(
  section: MarkLegendSection | undefined,
  color: number,
) {
  if (!section) {
    return undefined
  }
  const { scale, key } = section
  if (scale.kind === 'threshold' || scale.kind === 'identity') {
    const rows =
      scale.kind === 'threshold'
        ? thresholdRows(scale, key)
        : identityRows(scale, key)
    return rows.find(
      e => e.color !== undefined && cssColorToABGR(e.color) === color,
    )?.label
  }
  if (scale.kind !== 'categorical') {
    return undefined
  }
  const label = keyLabel(scale, key)
  const values = scale.entries
    .filter(e => e.color === color)
    .map(e => label(e.value))
  return values.length > 0 ? values.join(', ') : undefined
}
