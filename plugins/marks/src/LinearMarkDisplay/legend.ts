import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import type { MarkRegionData } from './markList.ts'
import type { ColorScale } from '@jbrowse/core/ui/colorScale'
import type { ScaleTable } from '@jbrowse/core/util/markEncoding'

const RAMP_STOPS = 8

/** One mark's colour key: the scale table its worker resolved, by mark. */
export interface MarkLegendSection {
  markIndex: number
  scale: ScaleTable
}

/**
 * The colour keys the loaded regions carry, one per scaled mark. A
 * categorical table is the union over regions in first-seen order, a label
 * keeping the colour the first region gave it; a ramp is the first region's,
 * since every region agrees once `domain` is pinned and disagrees otherwise
 * in a way no single bar could show.
 */
export function buildMarkLegend(
  regions: Iterable<MarkRegionData>,
  markCount: number,
): MarkLegendSection[] {
  const sections: (MarkLegendSection | undefined)[] = Array.from({
    length: markCount,
  })
  for (const region of regions) {
    region.layers.forEach((layer, markIndex) => {
      const { scale } = layer
      if (!scale) {
        return
      }
      const current = sections[markIndex]
      if (!current) {
        sections[markIndex] = {
          markIndex,
          scale:
            scale.kind === 'categorical'
              ? { ...scale, entries: [...scale.entries] }
              : scale,
        }
      } else if (
        current.scale.kind === 'categorical' &&
        scale.kind === 'categorical'
      ) {
        const seen = new Set(current.scale.entries.map(e => e.label))
        for (const entry of scale.entries) {
          if (!seen.has(entry.label)) {
            seen.add(entry.label)
            current.scale.entries.push(entry)
          }
        }
      }
    })
  }
  return sections.filter(s => s !== undefined)
}

/** The keys as the color scales `LegendMixin` derives the legend from. */
export function markColorScales(sections: MarkLegendSection[]): ColorScale[] {
  return sections.map(({ markIndex, scale }) =>
    scale.kind === 'categorical'
      ? {
          kind: 'categorical',
          id: `mark-${markIndex}`,
          title: scale.field,
          entries: scale.entries.map(e => ({
            value: e.label,
            label: e.label,
            color: abgrToCssRgba(e.color),
          })),
        }
      : {
          kind: 'ramp',
          id: `mark-${markIndex}`,
          title: scale.field,
          domain: scale.domain,
          stops: stopsFromRampLut(scale.lut, RAMP_STOPS),
        },
  )
}

/** The category a packed colour names in a categorical table, if any. */
export function categoryLabel(scale: ScaleTable | undefined, color: number) {
  return scale?.kind === 'categorical'
    ? scale.entries.find(e => e.color === color)?.label
    : undefined
}
