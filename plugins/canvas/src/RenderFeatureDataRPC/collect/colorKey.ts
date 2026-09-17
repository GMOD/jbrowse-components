import { categoricalPalette, categoricalScale } from '@jbrowse/core/ui/colors'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { createLegendCandidateCollector } from '@jbrowse/core/util/legendCandidates'
import { buildJexlContext } from '@jbrowse/core/util/simpleFeature'

import { featureColorScale } from '../featureColors.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { SectionStamp } from '../rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

type Reader = (feature: Feature) => unknown

function fieldReader(field: string, jexl: JexlInstance): Reader {
  if (!isJexl(field)) {
    return feature => feature.get(field)
  }
  try {
    const expr = stringToJexlExpression(field, jexl)
    return feature => {
      try {
        return expr.eval(buildJexlContext({ feature }))
      } catch {
        return undefined
      }
    }
  } catch {
    return () => undefined
  }
}

function labelOf(value: unknown) {
  return value === undefined || value === null
    ? ''
    : Array.isArray(value)
      ? value.map(String).join(',')
      : String(value)
}

// A part paints its record's value, not its own: an exon or CDS reads its
// transcript's, and a transcript without the field reads its gene's, so one
// transcript is one color whatever its parts carry.
function paintedLabel(box: Feature, read: Reader) {
  const isPart = !box.get('subfeatures')?.length
  let cur: Feature | undefined = (isPart ? box.parent?.() : undefined) ?? box
  while (cur !== undefined) {
    const label = labelOf(read(cur))
    if (label !== '') {
      return label
    }
    cur = cur.parent?.()
  }
  return ''
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
  const read = fieldReader(scale.field, jexl)
  const colorOf = categoricalScale(
    scale.domain,
    scale.palette,
    categoricalPalette,
  )
  const painted = new Map<string, { css: string; packed: number }>()
  const rows: SectionStamp[] = []
  const rowOf = new Map<string, number>()
  const collector = createLegendCandidateCollector()
  let row = 0
  return {
    rows,
    candidates: collector.candidates,
    enterRecord({ strand, groupKey }: SectionStamp) {
      const current = rows[row]
      if (
        current !== undefined &&
        current.strand === strand &&
        current.groupKey === groupKey
      ) {
        return
      }
      const id = JSON.stringify([strand, groupKey])
      let index = rowOf.get(id)
      if (index === undefined) {
        index = rows.length
        rows.push({ strand, groupKey })
        rowOf.set(id, index)
      }
      row = index
    },
    paint(box: Feature) {
      const label = paintedLabel(box, read)
      if (label === '') {
        return NO_CATEGORY_COLOR
      }
      let color = painted.get(label)
      if (color === undefined) {
        const css = colorOf(label)
        color = { css, packed: cssColorToABGR(css) }
        painted.set(label, color)
      }
      collector.add(row, label, color.packed)
      return color.css
    },
  }
}

export type ColorKey = NonNullable<ReturnType<typeof createColorKey>>
