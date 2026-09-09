import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/markEncoding'

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
      return scale
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
  if (current.kind === 'categorical' && next.kind === 'categorical') {
    unionEntries(current.entries, next.entries)
  } else if (current.kind === 'glyph' && next.kind === 'glyph') {
    unionEntries(current.entries, next.entries)
  }
}

/**
 * The keys the loaded regions carry, one per scaled channel per mark, in
 * mark order with colour before glyph. A categorical table is the union over
 * regions in first-seen order, the no-value row last; a label's entry is the
 * same in every region (a pinned `domain` walks the range, an unpinned one
 * derives from the value). A ramp is the first region's, since every region
 * agrees once `domain` is pinned and disagrees otherwise in a way no single
 * bar could show.
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
  for (const { scale } of sections) {
    if (scale.kind !== 'ramp') {
      missingRowLast(scale.entries)
    }
  }
  return sections
}

function missingRowLast(entries: { label: string }[]) {
  const missing = entries.findIndex(e => e.label === NO_VALUE_LABEL)
  if (missing !== -1 && missing !== entries.length - 1) {
    entries.push(...entries.splice(missing, 1))
  }
}

/**
 * The keys as the color scales `LegendMixin` derives the legend from. A
 * glyph table is a categorical scale whose swatches are the glyphs, drawn in
 * the text colour: the key describes the glyph channel, not the colour one.
 */
export function markColorScales(sections: MarkLegendSection[]): ColorScale[] {
  return sections.map(({ markIndex, channel, scale }) => {
    const id = `mark-${markIndex}-${channel}`
    switch (scale.kind) {
      case 'categorical':
        return {
          kind: 'categorical',
          id,
          title: scale.field,
          entries: scale.entries.map(e => ({
            value: e.label,
            label: e.label,
            color: abgrToCssRgba(e.color),
          })),
        }
      case 'glyph':
        return {
          kind: 'categorical',
          id,
          title: scale.field,
          entries: scale.entries.map(e => ({
            value: e.label,
            label: e.label,
            swatches: [{ color: 'currentColor', glyph: e.glyph }],
          })),
        }
      case 'ramp':
        return {
          kind: 'ramp',
          id,
          title: scale.field,
          domain: scale.domain,
          stops: stopsFromRampLut(scale.lut, RAMP_STOPS),
        }
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
