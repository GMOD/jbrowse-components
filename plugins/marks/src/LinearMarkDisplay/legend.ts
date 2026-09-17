import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ScaleTable } from '@jbrowse/core/util/markEncoding'

const RAMP_STOPS = 8

export type ScaledChannel = 'color' | 'glyph'

/** One scaled channel's key: the table its worker resolved, by mark. */
export interface MarkLegendSection {
  markIndex: number
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
    case 'glyph':
      return { ...scale, entries: [...scale.entries] }
  }
}

function unionEntries<E extends { label: string }>(
  into: E[],
  from: readonly E[],
) {
  const seen = new Set(into.map(e => e.label))
  for (const entry of from) {
    if (!seen.has(entry.label)) {
      seen.add(entry.label)
      into.push(entry)
    }
  }
}

function union(current: ScaleTable, next: ScaleTable) {
  switch (current.kind) {
    case 'categorical':
      if (next.kind === 'categorical') {
        unionEntries(current.entries, next.entries)
      }
      break
    case 'glyph':
      if (next.kind === 'glyph') {
        unionEntries(current.entries, next.entries)
      }
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

/**
 * The keys the loaded regions carry, one per scaled channel per mark, in
 * mark order with colour before glyph. A categorical table is the union over
 * regions in first-seen order, the no-value row last; a label's entry is the
 * same in every region (a pinned `domain` walks the range, an unpinned one
 * derives from the value). A ramp's domain is the union of the regions' own
 * extremes, or the pinned one where the config listed it — the same number
 * the shapes read as a uniform, so the bar cannot label a value the plot
 * paints elsewhere.
 */
export function buildMarkLegend(
  regions: Iterable<MarkRegionData>,
): MarkLegendSection[] {
  const sections: MarkLegendSection[] = []
  for (const region of regions) {
    region.layers.forEach((layer, markIndex) => {
      for (const { channel, tableOf } of CHANNELS) {
        const scale = tableOf(layer)
        if (!scale) {
          continue
        }
        const current = sections.find(
          s => s.markIndex === markIndex && s.channel === channel,
        )
        if (current) {
          union(current.scale, scale)
        } else {
          sections.push({ markIndex, channel, scale: copyOf(scale) })
        }
      }
    })
  }
  sections.sort(
    (a, b) =>
      a.markIndex - b.markIndex ||
      CHANNELS.findIndex(c => c.channel === a.channel) -
        CHANNELS.findIndex(c => c.channel === b.channel),
  )
  return sections
}

// A mark's glyph table over the same field its categorical colour reads:
// the two keys would list the same values twice under one title, so the
// colour key draws the glyph as its swatch and the glyph key is folded away.
function glyphOverSameField(
  sections: MarkLegendSection[],
  colour: MarkLegendSection,
) {
  const field = colour.scale.kind === 'categorical' && colour.scale.field
  const glyph = sections.find(
    s =>
      s.markIndex === colour.markIndex &&
      s.channel === 'glyph' &&
      s.scale.kind === 'glyph' &&
      s.scale.field === field,
  )
  return glyph?.scale.kind === 'glyph' ? glyph : undefined
}

/**
 * The keys as the color scales `LegendMixin` derives the legend from. A
 * glyph table is a categorical scale whose swatches are the glyphs, drawn in
 * the text colour: the key describes the glyph channel, not the colour one —
 * unless the colour is a categorical scale over the same field, when one key
 * carries both, each swatch the value's glyph in the value's colour.
 */
export function markColorScales(sections: MarkLegendSection[]): ColorScale[] {
  const folded = new Set<MarkLegendSection>()
  return sections.flatMap((section): ColorScale[] => {
    if (folded.has(section)) {
      return []
    }
    const { markIndex, channel, scale } = section
    const id = `mark-${markIndex}-${channel}`
    switch (scale.kind) {
      case 'categorical': {
        const glyph = glyphOverSameField(sections, section)
        if (glyph) {
          folded.add(glyph)
        }
        const glyphOf = (label: string) =>
          glyph?.scale.kind === 'glyph'
            ? glyph.scale.entries.find(e => e.label === label)?.glyph
            : undefined
        return [
          {
            kind: 'categorical',
            id,
            title: scale.field,
            entries: scale.entries.map(e => {
              const color = abgrToCssRgba(e.color)
              const g = glyphOf(e.label)
              const row = g
                ? {
                    value: e.label,
                    label: e.label,
                    swatches: [{ color, glyph: g }],
                  }
                : { value: e.label, label: e.label, color }
              return e.missing ? { ...row, missing: true } : row
            }),
          },
        ]
      }
      case 'glyph':
        return [
          {
            kind: 'categorical',
            id,
            title: scale.field,
            entries: scale.entries.map(e => ({
              value: e.label,
              label: e.label,
              swatches: [{ color: 'currentColor', glyph: e.glyph }],
              ...(e.missing ? { missing: true } : {}),
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
  return sections.find(s => s.markIndex === markIndex && s.channel === 'color')
    ?.scale
}

/** The category a packed colour names in a categorical table, if any. */
export function categoryLabel(scale: ScaleTable | undefined, color: number) {
  return scale?.kind === 'categorical'
    ? scale.entries.find(e => e.color === color)?.label
    : undefined
}
