import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { createLegendCandidateCollector } from '@jbrowse/core/util/legendCandidates'
import {
  categoricalColorField,
  colorEncodingOf,
} from '@jbrowse/display-kit/colorConfigSchema'

import type { DisplayConfig } from '../renderConfig.ts'
import type { SectionStamp } from '../rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export interface PaintedValue {
  key: string
  css: string
  packed: number
}

/**
 * The color channel's scale for one region's walk, and the key it derives:
 * every value a box painted, with that color and the section its record files
 * under, so the key lists exactly what was painted and a hidden section's
 * values can leave it.
 */
export function createColorKey(config: DisplayConfig, jexl: JexlInstance) {
  const field = categoricalColorField(
    colorEncodingOf(config.color, 'categorical'),
  )
  if (!field) {
    return undefined
  }
  const read = fieldReader(field.field, jexl)
  const painted = new Map<string, PaintedValue>()
  const rows: SectionStamp[] = []
  const rowOf = new Map<string, number>()
  const collector = createLegendCandidateCollector()
  let row = 0

  // A box paints its level's value — a transcript's, for its exons and CDS —
  // or the nearest ancestor's, and its own only where nothing above carries
  // the field.
  function valueAt(box: Feature, level: Feature) {
    for (let cur: Feature | undefined = level; cur; cur = cur.parent?.()) {
      const value = read(cur)
      if (valueText(value) !== '') {
        return value
      }
    }
    return box === level ? undefined : read(box)
  }

  return {
    rows,
    candidates: collector.candidates,
    enterRecord(stamp: SectionStamp) {
      const current = rows[row]
      if (
        current !== undefined &&
        current.strand === stamp.strand &&
        current.groupKey === stamp.groupKey
      ) {
        return
      }
      const id = JSON.stringify([stamp.strand, stamp.groupKey])
      let index = rowOf.get(id)
      if (index === undefined) {
        index = rows.length
        rows.push({ strand: stamp.strand, groupKey: stamp.groupKey })
        rowOf.set(id, index)
      }
      row = index
    },
    valueOf(box: Feature, level: Feature): PaintedValue {
      const key = field.key(valueAt(box, level))
      let value = painted.get(key)
      if (value === undefined) {
        const css = field.color(key)
        value = { key, css, packed: cssColorToABGR(css) }
        painted.set(key, value)
      }
      return value
    },
    record({ key, packed }: PaintedValue) {
      collector.add(row, key, packed)
    },
  }
}

export type ColorKey = NonNullable<ReturnType<typeof createColorKey>>
