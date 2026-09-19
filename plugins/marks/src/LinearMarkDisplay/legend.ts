import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { CategoricalScale, ColorScale } from '@jbrowse/core/ui/colorScale'
import type { LegendSwatch } from '@jbrowse/core/ui/legendSpec'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { GlyphName, ScaleTable } from '@jbrowse/core/util/markEncoding'

const RAMP_STOPS = 8

// Rows past which a key over a numeric field has stopped being a vocabulary.
// A numeric field genuinely used as one — a rank, a copy number, a tier — has
// a handful of values; past eight the key is a rainbow and the author meant a
// colour scale. The neighbouring `legendIsReadable` answers a different
// question, whether a key is worth its rows at all, and its bar is 20.
const NUMERIC_KEY_HINT_ROWS = 8

const NUMERIC_KEY_HINT =
  "numeric values drawn as categories; set scale: 'linear' or a ramp for a color scale"

export type ScaledChannel = 'color' | 'glyph'

/**
 * One scaled channel's key: the table the worker resolved, and the marks it
 * is the key of. Marks whose channel reads one field through one declared
 * order and palette (or glyph range) share a section, the way ggplot2 keeps
 * one scale per aesthetic across layers; a ramp is each mark's own.
 */
export interface MarkLegendSection {
  markIndexes: number[]
  channel: ScaledChannel
  scale: ScaleTable
}

const CHANNELS: {
  channel: ScaledChannel
  tableOf: (layer: StoredLayer) => ScaleTable | undefined
}[] = [
  { channel: 'color', tableOf: l => l.scale },
  { channel: 'glyph', tableOf: l => l.glyphScale },
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
    case 'threshold':
      return { ...scale, entries: [...scale.entries] }
    case 'glyph':
      return { ...scale, entries: [...scale.entries] }
  }
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
    case 'glyph':
      if (next.kind === 'glyph') {
        unionEntries(current.entries, next.entries)
      }
      break
    case 'threshold':
      // Identical in every region: the section key already holds the field
      // and the cut points, and the palette follows from them.
      break
    case 'ramp':
      // An unpinned ramp's domain is the union of the regions' extremes,
      // which is the same number the shapes read as a uniform, so the key
      // and the painting cannot disagree across a pan. A pinned one already
      // agrees.
      if (next.kind === 'ramp' && !current.pinned && !next.pinned) {
        current.extent = [
          Math.min(current.extent[0], next.extent[0]),
          Math.max(current.extent[1], next.extent[1]),
        ]
        current.domain = [current.extent[0], current.extent[1]]
      }
      break
  }
}

// What a section is keyed on: the declaration that assigns a categorical
// value its colour or glyph, so two marks sharing it share the key; a ramp
// stays the mark's, its domain being the uniform that mark's shapes read.
function sectionKey(markIndex: number, scale: ScaleTable) {
  switch (scale.kind) {
    case 'ramp':
      return JSON.stringify(['ramp', markIndex])
    case 'categorical':
      return JSON.stringify([
        'categorical',
        scale.field,
        scale.domain,
        scale.palette ?? [],
      ])
    case 'threshold':
      return JSON.stringify(['threshold', scale.field, scale.domain])
    case 'glyph':
      return JSON.stringify([
        'glyph',
        scale.field,
        scale.domain,
        scale.range ?? [],
      ])
  }
}

/**
 * The keys the loaded regions carry, one per scale, in the order of the first
 * mark drawing through each with colour before glyph. A categorical table is
 * the union over regions and over the marks declaring it alike, in the
 * field's order; a key's entry is the same in every region. A ramp's domain is
 * the union of the regions' own extremes, or the pinned one where the config
 * listed it — the same number the shapes read as a uniform.
 */
export function buildMarkLegend(
  regions: Iterable<MarkRegionData>,
  showsMark: (markIndex: number) => boolean = () => true,
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
        const key = sectionKey(markIndex, scale)
        const current = sections.get(key)
        if (!current) {
          sections.set(key, {
            markIndexes: [markIndex],
            channel,
            scale: copyOf(scale),
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
  return [...sections.values()].sort(
    (a, b) =>
      a.markIndexes[0]! - b.markIndexes[0]! ||
      CHANNELS.findIndex(c => c.channel === a.channel) -
        CHANNELS.findIndex(c => c.channel === b.channel),
  )
}

// A glyph table over the same field a categorical colour reads, on marks
// that colour also keys: the two keys would list the same values twice under
// one title, so the colour key draws the glyph as its swatch and the glyph
// key is folded away.
function glyphOverSameField(
  sections: MarkLegendSection[],
  colour: MarkLegendSection,
) {
  const field = colour.scale.kind === 'categorical' && colour.scale.field
  const glyph = sections.find(
    s =>
      s.channel === 'glyph' &&
      s.scale.kind === 'glyph' &&
      s.scale.field === field &&
      s.markIndexes.every(i => colour.markIndexes.includes(i)),
  )
  return glyph?.scale.kind === 'glyph' ? glyph : undefined
}

// A key over the facet's own field lists its rows in the sections' order, so
// the key and the chips read top to bottom alike.
function categoricalKey<E extends { value: string }>(
  id: string,
  scale: { field: string; domain: string[]; entries: E[] },
  swatchOf: (entry: E) => { color: string } | { swatches: LegendSwatch[] },
  facet: CategoricalField | undefined,
): CategoricalScale {
  const field =
    facet?.field === scale.field
      ? facet
      : categoricalField(scale.field, { domain: scale.domain })
  return {
    kind: 'categorical',
    id,
    title: scale.field,
    entries: scale.entries
      .toSorted((a, b) => field.compare(a.value, b.value))
      .map(e => ({
        value: e.value,
        label: field.label(e.value),
        ...swatchOf(e),
        ...(e.value === '' ? { missing: true } : {}),
      })),
  }
}

/**
 * The keys as the color scales `LegendMixin` derives the legend from. A
 * glyph table is a categorical scale whose swatches are the glyphs, drawn in
 * the text colour: the key describes the glyph channel, not the colour one —
 * unless the colour is a categorical scale over the same field, when one key
 * carries both, each swatch the value's glyph in the value's colour.
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
    const { markIndexes, channel, scale } = section
    const id = `mark-${markIndexes.join('-')}-${channel}`
    switch (scale.kind) {
      case 'categorical': {
        const glyph = glyphOverSameField(sections, section)
        if (glyph) {
          folded.add(glyph)
        }
        const glyphOf = (value: string) =>
          glyph?.scale.kind === 'glyph'
            ? glyph.scale.entries.find(e => e.value === value)?.glyph
            : undefined
        const key = categoricalKey(
          id,
          scale,
          ({ value, color }) => {
            const css = abgrToCssRgba(color)
            const g = glyphOf(value)
            return g ? { swatches: [{ color: css, glyph: g }] } : { color: css }
          },
          facet,
        )
        return [
          scale.numericKeys && key.entries.length > NUMERIC_KEY_HINT_ROWS
            ? { ...key, note: NUMERIC_KEY_HINT }
            : key,
        ]
      }
      case 'glyph':
        return [
          categoricalKey(
            id,
            scale,
            e => ({ swatches: [{ color: 'currentColor', glyph: e.glyph }] }),
            facet,
          ),
        ]
      case 'threshold':
        return [
          {
            kind: 'categorical',
            id,
            title: scale.field,
            entries: scale.entries.map(e => ({
              value: e.value,
              label: e.value,
              color: abgrToCssRgba(e.color),
            })),
          },
        ]
      case 'ramp':
        return [
          {
            kind: 'ramp',
            id,
            title: scale.field,
            domain: scale.domain,
            stops: stopsFromRampLut(scale.lut, RAMP_STOPS),
          },
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

/** The glyph key of one mark, if its glyph is a scale. */
export function glyphSection(sections: MarkLegendSection[], markIndex: number) {
  return sections.find(
    s => s.channel === 'glyph' && s.markIndexes.includes(markIndex),
  )?.scale
}

/**
 * The categories a glyph names in a glyph table: three glyphs over any number
 * of values, so a glyph the range handed out twice names both, the way a key
 * derived from the painting lists every value drawn in one colour.
 */
export function glyphLabel(scale: ScaleTable | undefined, glyph: GlyphName) {
  if (scale?.kind !== 'glyph') {
    return undefined
  }
  const field = categoricalField(scale.field)
  const values = scale.entries
    .filter(e => e.glyph === glyph)
    .map(e => field.label(e.value))
  return values.length > 0 ? values.join(', ') : undefined
}

/** The interval or category a packed colour names, if its table has one. */
export function categoryLabel(scale: ScaleTable | undefined, color: number) {
  if (scale?.kind === 'threshold') {
    return scale.entries.find(e => e.color === color)?.value
  }
  if (scale?.kind !== 'categorical') {
    return undefined
  }
  const entry = scale.entries.find(e => e.color === color)
  return entry && categoricalField(scale.field).label(entry.value)
}
