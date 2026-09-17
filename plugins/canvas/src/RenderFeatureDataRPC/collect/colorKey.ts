import { categoricalColorScale } from '@jbrowse/core/ui/colors'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { createLegendCandidateCollector } from '@jbrowse/core/util/legendCandidates'
import { NO_VALUE_LABEL } from '@jbrowse/core/util/markEncoding'
import { STRAND_FIELD, readStrand } from '@jbrowse/core/util/strandScale'

import { featureColorScale } from '../featureColors.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { SectionStamp } from '../rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export interface PaintedValue {
  label: string
  css: string
  packed: number
}

function labelOf(value: unknown) {
  return value === undefined || value === null
    ? ''
    : Array.isArray(value)
      ? value.map(String).join(',')
      : String(value)
}

/**
 * The color channel's scale for one region's walk, and the key it derives:
 * every value a box painted, with that color and the section its record files
 * under, so the key lists exactly what was painted and a hidden section's
 * values can leave it.
 */
export function createColorKey(config: DisplayConfig, jexl: JexlInstance) {
  const scale = featureColorScale(config)
  if (!scale) {
    return undefined
  }
  const read =
    scale.field === STRAND_FIELD ? readStrand : fieldReader(scale.field, jexl)
  const colorOf = categoricalColorScale(scale.domain, scale.palette)
  const painted = new Map<string, PaintedValue>()
  const missing = {
    label: NO_VALUE_LABEL,
    css: NO_CATEGORY_COLOR,
    packed: cssColorToABGR(NO_CATEGORY_COLOR),
  }
  const rows: SectionStamp[] = []
  const rowOf = new Map<string, number>()
  const collector = createLegendCandidateCollector()
  let row = 0

  // A box paints its level's value — a transcript's, for its exons and CDS —
  // or the nearest ancestor's, and its own only where nothing above carries
  // the field.
  function labelAt(box: Feature, level: Feature) {
    for (let cur: Feature | undefined = level; cur; cur = cur.parent?.()) {
      const label = labelOf(read(cur))
      if (label !== '') {
        return label
      }
    }
    return box === level ? '' : labelOf(read(box))
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
      const label = labelAt(box, level)
      if (label === '') {
        return missing
      }
      let value = painted.get(label)
      if (value === undefined) {
        const css = colorOf(label)
        value = { label, css, packed: cssColorToABGR(css) }
        painted.set(label, value)
      }
      return value
    },
    record({ label, packed }: PaintedValue) {
      collector.add(row, label, packed)
    },
  }
}

export type ColorKey = NonNullable<ReturnType<typeof createColorKey>>
