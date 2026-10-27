import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'
import { MAX_LEGEND_CANDIDATES } from '@jbrowse/core/util/legendCandidates'

import type { DisplayConfig } from '../renderConfig.ts'
import type { ColorValues, SectionStamp } from '../rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * The color field's values for one region's walk: each box a field could
 * paint carries its value's index into `values`, and `painted` lists every
 * value with the section its record files under. The scale that turns a value
 * into a color is the main thread's, so a recolor re-encodes what is loaded.
 */
export function createColorKey(config: DisplayConfig, jexl: JexlInstance) {
  const { field } = config.color
  if (!field) {
    return undefined
  }
  const read = fieldReader(field, jexl)
  const values: string[] = []
  const indexOfText = new Map<string, number>()
  const rows: SectionStamp[] = []
  const rowOf = new Map<string, number>()
  const painted: ColorValues['painted'] = []
  const paintedIds = new Set<string>()
  let row = 0

  // A box paints its level's value — a transcript's, for its exons and CDS —
  // or the nearest ancestor's, and its own only where nothing above carries
  // the field.
  function textAt(box: Feature, level: Feature) {
    for (let cur: Feature | undefined = level; cur; cur = cur.parent?.()) {
      const text = valueText(read(cur))
      if (text !== '') {
        return text
      }
    }
    return box === level ? '' : valueText(read(box))
  }

  return {
    field,
    values,
    rows,
    painted,
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
    // One-based, the lane's 0 being "no field value".
    laneValueOf(box: Feature, level: Feature) {
      const text = textAt(box, level)
      let index = indexOfText.get(text)
      if (index === undefined) {
        index = values.length
        values.push(text)
        indexOfText.set(text, index)
      }
      return index + 1
    },
    // Bounded as a derived key's candidates are: a field valued per feature
    // is no vocabulary, and past the bound the key says nothing new.
    record(laneValue: number) {
      const valueIndex = laneValue - 1
      const id = `${row}:${valueIndex}`
      if (painted.length < MAX_LEGEND_CANDIDATES && !paintedIds.has(id)) {
        paintedIds.add(id)
        painted.push({ rowIndex: row, valueIndex })
      }
    },
  }
}

export type ColorKey = NonNullable<ReturnType<typeof createColorKey>>
