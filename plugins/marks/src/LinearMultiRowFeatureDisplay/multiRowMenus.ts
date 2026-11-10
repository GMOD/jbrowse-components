import { radioItems } from '@jbrowse/core/ui/menuItems'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { BED_COLOR_FIELDS } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  colorByMenuItem,
  colorFieldMenuItems,
} from '@jbrowse/display-kit/colorByMenu'
import TableRowsIcon from '@mui/icons-material/TableRows'

import { isRowField } from '../LinearMarkDisplay/rowFields.ts'

import type { PlotFields } from '../LinearMarkDisplay/scanPlotFields.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const BED_COLOR = new Set<string>(BED_COLOR_FIELDS)

/** The attributes Color by lists beside its Strand and itemRgb rows. */
export function colorFieldChoices(attributes: readonly string[]) {
  return attributes.filter(
    name => name !== STRAND_FIELD && !BED_COLOR.has(name),
  )
}

export interface MultiRowMenuModel {
  plotFields: PlotFields | undefined
  /** A facet splitting the features into sections, which draw in the rows' place. */
  facet?: object
  rowsField: string
  setRowsField: (field: string) => void
  colorField: string | undefined
  colorByMode: 'default' | 'solid' | 'strand' | 'itemRgb' | 'attribute'
  colorByIdentity: () => void
  colorByField: (field: string) => void
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

// The scanned choices, and the field in force where the scan met none, so it
// still reads as chosen.
function withFieldInForce(
  choices: readonly string[],
  current: string | undefined,
) {
  return current === undefined ||
    current === '' ||
    isJexl(current) ||
    choices.includes(current)
    ? choices
    : [...choices, current]
}

// Offered while the display draws rows or one lane; a facet's sections take
// the rows' place, where a pick would change nothing on screen.
function rowsFieldMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.rowsField
  const fields = withFieldInForce(
    (self.plotFields?.attributes ?? []).filter(isRowField),
    current,
  )
  return fields.length > 0 && self.facet === undefined
    ? [
        {
          label: 'One row per',
          icon: TableRowsIcon,
          subMenu: [
            ...customExpressionItems(current),
            ...radioItems(
              fields.map(value => ({ value, label: value })),
              isJexl(current) ? undefined : current,
              field => {
                self.setRowsField(field)
              },
            ),
          ],
        },
      ]
    : []
}

// Strand as the feature display offers it, the file's own colors where the
// scan found a feature stating one, then a row per attribute.
function colorByMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.colorField
  const fields = withFieldInForce(
    colorFieldChoices(self.plotFields?.attributes ?? []),
    current === STRAND_FIELD ? undefined : current,
  )
  return [
    colorByMenuItem({
      blocks: [
        {
          rows: [
            ...customExpressionItems(current),
            ...colorFieldMenuItems(self, [
              {
                label: 'Strand',
                field: STRAND_FIELD,
                checked: self.colorByMode === 'strand',
              },
              ...(self.plotFields?.bedColored || self.colorByMode === 'itemRgb'
                ? [
                    {
                      label: 'itemRgb',
                      checked: self.colorByMode === 'itemRgb',
                      onClick: () => {
                        self.colorByIdentity()
                      },
                    },
                  ]
                : []),
              ...fields.map(field => ({
                label: field,
                field,
                checked: current === field,
              })),
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
