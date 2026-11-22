import { cssColorToABGR, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import {
  attributeOf,
  createAttributeChannels,
  createComparativeColorFunction,
  noStrandLevel,
  opacityFadeOf,
  opacityLevel,
  SYNTENY_VIEW_FIELDS,
  writeFeatureChannels,
} from '@jbrowse/synteny-core'

import { isArrayRecord } from '../syntenyMate.ts'

import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type {
  AttributeRange,
  ColorFunctionInputs,
  SyntenyColorPaint,
  SyntenyOpacitySnapshot,
} from '@jbrowse/synteny-core'

/** Every ribbon's opacity while `ribbons.encoding.opacity` is unset. */
export const RIBBON_OPACITY = 0.3

const LANE_FIELDS: ReadonlySet<string> = new Set([
  ...SYNTENY_VIEW_FIELDS,
  'length',
])

// a lane pair joins many sequences, so the sequence-name fields leave each
// ribbon its own color
function paintedField(field: string | undefined) {
  return field === 'query' || field === 'target' ? undefined : field
}

/**
 * Each ribbon's color, through the synteny views' color, opacity and filter
 * functions over the channels the worker writes for a fetch: `records` are
 * written once into lanes the functions index, so a ribbon reads its record
 * as two-way synteny reads it. A record joins pairs of either strand, so each
 * call writes the pair's strand into the record's slot before reading it.
 * A paint and filter reading no attribute share one slot, and `records` go
 * unread. Undefined is a ribbon core paints at zero alpha, one the `filter`
 * drops or the fade clears, which draws nothing and offers no hover target,
 * as in two-way synteny. The opacity level scales what is left. Painted by
 * strand, an array record takes the strand scale's no-strand color, since
 * its strand is only a vote of its bases.
 */
export function ribbonPaintOf({
  records,
  field,
  ribbonColor,
  attributeRanges,
  opacity,
  filter,
  paint = {},
}: {
  records: Iterable<Feature>
  field: string | undefined
  ribbonColor: string
  attributeRanges: Record<string, AttributeRange>
  opacity: SyntenyOpacitySnapshot
  filter: readonly FieldPredicate[]
  paint?: SyntenyColorPaint
}): (record: Feature, strand: number) => number | undefined {
  const fade = opacityFadeOf(opacity)
  const read = [field, fade?.field, ...filter.map(p => p.field)].filter(
    (f): f is string => f !== undefined && !LANE_FIELDS.has(f),
  )
  const index = new Map<Feature, number>()
  const list: Feature[] = []
  if (read.length > 0) {
    for (const record of records) {
      if (!index.has(record)) {
        index.set(record, list.length)
        list.push(record)
      }
    }
  }
  const slots = Math.max(1, list.length)
  const channels = createAttributeChannels(read.map(attributeOf), list.length)
  for (const [i, record] of list.entries()) {
    writeFeatureChannels(channels.list, i, record)
  }
  const { attributes, attributeRanges: fetchRanges } = channels.finish(
    list.length,
  )
  const strands = new Int8Array(slots)
  const data: ColorFunctionInputs = {
    strands,
    refNameDict: [],
    refNameIds: new Uint32Array(slots),
    mateRefNameDict: [],
    mateRefNameIds: new Uint32Array(slots),
    attributes,
    attributeRanges: fetchRanges,
  }
  let current: Feature | undefined
  const colorAt = createComparativeColorFunction({
    field: paintedField(field),
    data,
    trackColor: ribbonColor,
    defaultColor: cssColorToABGR(ribbonColor),
    attributeRanges,
    paint: { ...paint, invalid: paint.invalid ?? ribbonColor },
    opacity: fade,
    filter,
    filterExtras: {
      lengthOf: () => current!.get('end') - current!.get('start'),
    },
  })
  const level = opacityLevel(opacity, RIBBON_OPACITY, attributeRanges)
  const repeat =
    paintedField(field) === 'strand'
      ? cssColorToABGR(noStrandLevel(paint).color)
      : undefined
  return (record, strand) => {
    const i = index.get(record) ?? 0
    current = record
    strands[i] = strand
    const painted = colorAt(i)
    const alpha = painted >>> 24
    return alpha === 0
      ? undefined
      : withAbgrAlpha(
          repeat !== undefined && isArrayRecord(record) ? repeat : painted,
          Math.round(alpha * level),
        )
  }
}
