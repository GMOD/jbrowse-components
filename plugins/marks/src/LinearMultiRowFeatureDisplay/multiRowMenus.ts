import { radioItems } from '@jbrowse/core/ui/menuItems'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { BED_COLOR_FIELDS } from '@jbrowse/core/util/colorBits'
import { isJexl } from '@jbrowse/core/util/jexlStrings'
import {
  colorByMenuItem,
  colorFieldMenuItems,
} from '@jbrowse/display-kit/colorByMenu'
import { groupByRadioMenuItem } from '@jbrowse/display-kit/groupByMenu'
import TableRowsIcon from '@mui/icons-material/TableRows'

import { rowsFieldChoices } from './multiRowPlot.ts'

import type { MenuItem } from '@jbrowse/core/ui'

const BED_COLOR = new Set<string>(BED_COLOR_FIELDS)

/** The attributes Color by lists beside its Strand and itemRgb rows. */
export function colorFieldChoices(attributes: readonly string[]) {
  return attributes.filter(
    name => name !== STRAND_FIELD && !BED_COLOR.has(name),
  )
}

/** Whether the features carry a BED color column, which Color by's itemRgb row paints. */
export function carriesBedColor(attributes: readonly string[]) {
  return attributes.some(name => BED_COLOR.has(name))
}

export interface MultiRowMenuModel {
  attributes: readonly string[]
  rowsField: string
  setRowsField: (field: string) => void
  colorField: string | undefined
  colorByMode: 'default' | 'solid' | 'strand' | 'itemRgb' | 'attribute'
  colorByIdentity: () => void
  colorByField: (field: string) => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  setShowLegend: (show: boolean) => void
  facet?: { field: string }
  rowColorFields: readonly string[]
  facetByField: (field: string) => void
}

// A `jexl:` field checks no radio and lists a disabled row naming it:
// nothing here could write one back once a pick replaced it.
function customExpressionItems(field: string | undefined): MenuItem[] {
  return field !== undefined && isJexl(field)
    ? [{ label: 'Custom expression', disabled: true, onClick: () => {} }]
    : []
}

function rowsFieldMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.rowsField
  const choices = rowsFieldChoices(self.attributes)
  const fields =
    current === '' || isJexl(current) || choices.includes(current)
      ? choices
      : [...choices, current]
  return fields.length > 0
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
// features carry a BED color column, then a row per attribute, the painting
// field kept among them while the scan met none.
function colorByMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.colorField
  const choices = colorFieldChoices(self.attributes)
  const fields =
    current === undefined ||
    current === STRAND_FIELD ||
    isJexl(current) ||
    choices.includes(current)
      ? choices
      : [...choices, current]
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
              ...(carriesBedColor(self.attributes) ||
              self.colorByMode === 'itemRgb'
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

// The facet's own field stays a radio while no row carries it, so a config's
// `facet: 'group'` reads checked before the rows load.
function groupByMenuItems(self: MultiRowMenuModel): MenuItem[] {
  const current = self.facet?.field
  const fields =
    current === undefined || self.rowColorFields.includes(current)
      ? self.rowColorFields
      : [...self.rowColorFields, current]
  return fields.length > 0
    ? [
        groupByRadioMenuItem({
          current,
          options: fields.map(field => ({ type: field, label: field })),
          onSelect: field => {
            self.facetByField(field)
          },
          onNone: () => {
            self.facetByField('')
          },
        }),
      ]
    : []
}

/** The painting's own track menu rows, beside the mark display's. */
export function multiRowMenuItems(self: MultiRowMenuModel): MenuItem[] {
  return [
    ...rowsFieldMenuItems(self),
    ...groupByMenuItems(self),
    ...colorByMenuItems(self),
  ]
}
