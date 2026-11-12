import { pairedColorsOf } from '@jbrowse/display-kit/colorConfigSchema'

import { rowFieldValue } from '../rows/rowFields.ts'
import { rowColorKeyEntries } from './rowColorKey.ts'

import type { RowAnnotationColumn, RowSource } from '../types.ts'
import type { RowColorSetting } from './rowColors.ts'
import type { CategoricalScale } from '@jbrowse/core/ui/colorScale'

const NONE: ReadonlyMap<string, string> = new Map()

/**
 * One `rows.annotations` entry as read: its channel; its title, which names
 * its key and the label over its column, `legend.title` else the field
 * capitalised; and its place in the list, which picks the palette it deals
 * from whatever the entries before it draw.
 */
export interface RowAnnotationSetting extends RowColorSetting {
  title: string
  position: number
}

/**
 * One `rows.annotations` entry dealt: its setting, and the color each value
 * of its field takes.
 */
export interface RowAnnotationDeal {
  setting: RowAnnotationSetting
  dealt: ReadonlyMap<string, string>
}

/**
 * One `rows.annotations` entry drawn: its deal, and its column, each drawn
 * row's color by name.
 */
export interface RowAnnotationDrawn extends RowAnnotationDeal {
  colors: RowAnnotationColumn
}

/**
 * The column one annotation draws: each row's color by name, the color its
 * value of the annotation's field was dealt. A row whose value took none has
 * no entry.
 */
export function annotationColumn(
  rows: readonly RowSource[],
  { setting, dealt }: RowAnnotationDeal,
): RowAnnotationColumn {
  return new Map(
    rows.flatMap(row => {
      const color = dealt.get(rowFieldValue(row, setting.field))
      return color === undefined ? [] : [[row.name, color] as const]
    }),
  )
}

/**
 * The id of the key of the `rows.annotations` entry at `position` in the
 * config list, so an entry before it drawing nothing moves no key's id, nor
 * which keys a reader dismissed.
 */
function rowAnnotationScaleId(position: number) {
  return `rows.annotations.${position}`
}

/**
 * One key per annotation drawn, titled as its column is labelled: the values
 * some row of `rows` carries with a color, listed as the row color key lists
 * an attribute's.
 */
export function rowAnnotationScales(
  rows: readonly RowSource[],
  drawn: readonly RowAnnotationDrawn[],
): CategoricalScale[] {
  return drawn.map(({ setting, dealt, colors }) => ({
    kind: 'categorical',
    id: rowAnnotationScaleId(setting.position),
    title: setting.title,
    entries: rowColorKeyEntries(
      rows,
      {
        setting,
        pairs: pairedColorsOf(setting.scale),
        dealt,
        resolved: colors,
        pinned: NONE,
        alias: undefined,
      },
      name => name,
    ),
  }))
}
