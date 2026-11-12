import { baseRows } from '../rows/baseRows.ts'
import { IDENTITY_FIELDS, extraColumns } from '../rows/rowFields.ts'
import {
  liftRowColor,
  pinnedColorsOf,
  rowColorChoiceOf,
  rowColorResetTarget,
  startingRowColor,
} from './rowColorChoice.ts'
import { withPinnedColors } from './rowColors.ts'

import type { BaseRowsHost } from '../rows/baseRows.ts'
import type { Row } from '../types.ts'
import type { RowColorSetting } from './rowColors.ts'

// A row's name, label and colors are what a row color is set on, never what
// one is set by.
const NOT_COLOR_FIELDS = new Set<string>([
  ...IDENTITY_FIELDS,
  'id',
  'label',
  'color',
  'rowColor',
])

/** The row color's hook: the fields a reader can color the rows by. */
export function rowColorFieldViews(self: { expandedRows: Row[] }) {
  return {
    /**
     * #getter
     * Overridable hook: the row fields a reader can color the rows by,
     * offered beside None and Each row. By default every field a row
     * has but its name, label and colors.
     */
    get rowColorFields(): readonly string[] {
      return extraColumns(self.expandedRows, NOT_COLOR_FIELDS)
    },
  }
}

/** What {@link rowColorViews} reads: the live `rows.color` and its base. */
export interface RowColorHost extends BaseRowsHost {
  rowColorChannel: RowColorSetting
  rowPaletteDeals: boolean
  rowColorFields: readonly string[]
}

/**
 * The choice of what colors the rows, as a menu and the arrangement dialog
 * offer it, and the `rows.color` a reset returns to.
 */
export function rowColorViews(self: RowColorHost) {
  return {
    /**
     * #getter
     * The `rows.color` object this display's base declares, which a reset
     * returns to and "is this the reader's" compares against.
     */
    get baseRowColorChannel(): RowColorSetting {
      return liftRowColor(baseRows(self).color)
    },
    /**
     * #getter
     * `rowColorSetting` as this display's base declares it.
     */
    get baseRowColorSetting(): RowColorSetting {
      return withPinnedColors(
        this.baseRowColorChannel,
        pinnedColorsOf(baseRows(self).colors),
      )
    },
    /**
     * #getter
     * Whether `rows.color` gives its field's values colors the config does
     * not, so "Reset row order" is offered for a recolor too: whether
     * `rowColorResetTarget` has anything to write. A choice of row color
     * source is no arrangement, so it is never custom. The pins are an
     * arrangement member.
     */
    get rowColorIsCustom(): boolean {
      return (
        rowColorResetTarget(
          self.rowColorChannel,
          this.baseRowColorChannel,
          self.rowPaletteDeals,
        ) !== undefined
      )
    },
    /**
     * #getter
     * The choice of what colors the rows, as the arrangement dialog and a menu
     * offer it: '' for none dealt, `name` for a palette color each, or a
     * field.
     */
    get rowColorChoice(): string {
      return rowColorChoiceOf(self.rowColorChannel, self.rowPaletteDeals)
    },
    /**
     * #method
     * The `rows.color` object `choice` starts from (`startingRowColor`):
     * the current object's where it shows that choice, else the config's.
     */
    rowColorFor(choice: string): RowColorSetting {
      return startingRowColor(
        choice,
        [self.rowColorChannel, this.baseRowColorChannel],
        self.rowPaletteDeals,
      )
    },
    /**
     * #getter
     * The fields a reader can color the rows by: `rowColorFields`, and
     * the current one where the rows lack it, so it still shows as chosen.
     */
    get rowColorFieldsOffered(): readonly string[] {
      const current = this.rowColorChoice
      const fields = self.rowColorFields
      return current === '' || current === 'name' || fields.includes(current)
        ? fields
        : [...fields, current]
    },
  }
}
