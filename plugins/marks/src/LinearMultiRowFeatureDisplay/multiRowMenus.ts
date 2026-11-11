import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  colorByMenuItem,
  colorFieldMenuItems,
} from '@jbrowse/display-kit/colorByMenu'
import TableRowsIcon from '@mui/icons-material/TableRows'

import { DEFAULT_ROWS_FIELD } from './multiRowRowsConfigSchema.ts'

import type { MenuItem } from '@jbrowse/core/ui'

export interface MultiRowMenuModel {
  /** A facet splitting the features into sections, which draw in the rows' place. */
  facet?: object
  rowsField: string
  setRowsField: (field: string) => void
  openRowsFieldDialog: () => void
  colorField: string | undefined
  colorByMode: 'default' | 'solid' | 'strand' | 'attribute' | 'custom'
  colorByField: (field: string) => void
  openColorByAttributeDialog: () => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  setShowLegend: (show: boolean) => void
}

// A `jexl:` field checks no radio and lists a disabled row naming it:
// nothing here could write one back once a pick replaced it.
function customExpressionItems(field: string | undefined): MenuItem[] {
  return field !== undefined && isJexl(field)
    ? [{ label: 'Custom expression', disabled: true, onClick: () => {} }]
    : []
}

// Offered while the display draws rows or one lane; a facet's sections take
// the rows' place, where a pick would change nothing on screen. Type is the
// default, None an explicit one row, and Attribute... any other field.
function rowsFieldMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.rowsField
  return self.facet === undefined
    ? [
        {
          label: 'One row per',
          icon: TableRowsIcon,
          subMenu: [
            ...customExpressionItems(current),
            {
              label: 'None (one row)',
              type: 'radio',
              checked: current === '',
              onClick: () => {
                self.setRowsField('')
              },
            },
            {
              label: 'Type',
              type: 'radio',
              checked: current === DEFAULT_ROWS_FIELD,
              onClick: () => {
                self.setRowsField(DEFAULT_ROWS_FIELD)
              },
            },
            {
              label: 'Attribute...',
              type: 'radio',
              checked:
                current !== '' &&
                current !== DEFAULT_ROWS_FIELD &&
                !isJexl(current),
              keepMenuOpen: false,
              onClick: () => {
                self.openRowsFieldDialog()
              },
            },
          ],
        },
      ]
    : []
}

// Default, the file's own colors; Strand as the feature display offers it;
// an attribute picked from the features in view; and a solid color.
function colorByMenuItems(self: MultiRowMenuModel): MenuItem[] {
  return [
    colorByMenuItem({
      blocks: [
        {
          rows: [
            ...customExpressionItems(self.colorField),
            ...colorFieldMenuItems(self, [
              {
                label: 'Strand',
                field: STRAND_FIELD,
                checked: self.colorByMode === 'strand',
              },
            ]),
          ],
        },
      ],
    }),
  ]
}

/** The painting's own track menu rows, beside the mark display's. */
export function multiRowMenuItems(self: MultiRowMenuModel): MenuItem[] {
  return [...rowsFieldMenuItems(self), ...colorByMenuItems(self)]
}
