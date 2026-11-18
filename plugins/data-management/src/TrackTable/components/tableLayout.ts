import { DEFAULT_COL_WIDTH } from '@jbrowse/core/ui/VirtualTable'

import { isUnsupported } from '../../HierarchicalTrackSelectorWidget/util.ts'
import { columnsThatFit } from './fitColumnWidths.ts'
import { CHECKBOX_WIDTH } from './tableStyles.ts'
import { facetLabel } from './util.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { TrackTableModel } from '../trackTableModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// a vertical scrollbar and the grid's border, which the column count has to
// leave room for before the grid can measure them
const GRID_CHROME = 18

// the drawer's padding around the grid, rounded up so a table sized to its
// natural width never cuts a name by a pixel
const DRAWER_GUTTER = 24

/**
 * the fields a table `width` px wide shows, name first
 */
export function shownFields(table: TrackTableModel, width: number) {
  return table.shownColumns(
    columnsThatFit(
      width - CHECKBOX_WIDTH - GRID_CHROME,
      table.initialWidths.name ?? DEFAULT_COL_WIDTH,
    ),
  )
}

/**
 * the drawer width at which every column the table can show fits at its
 * natural width
 */
export function naturalTableWidth(table: TrackTableModel) {
  return (
    CHECKBOX_WIDTH +
    GRID_CHROME +
    DRAWER_GUTTER +
    Object.values(table.initialWidths).reduce((a, b) => a + b, 0)
  )
}

/**
 * the table's own menu rows: adding what a filter kept to the selection, and
 * Manage columns
 */
export function tableMenuItems(
  model: HierarchicalTrackSelectorModel,
  table: TrackTableModel,
  shown: string[],
): MenuItem[] {
  const { narrowed, sortedRows, fields, nonMetadataFieldSet } = table
  return [
    ...(narrowed
      ? [
          {
            label: 'Add matching tracks to selection',
            onClick: () => {
              model.addToSelection(
                sortedRows
                  .filter(row => !isUnsupported(row.name))
                  .map(row => row.id),
              )
            },
          },
        ]
      : []),
    {
      label: 'Manage columns',
      type: 'subMenu',
      subMenu: fields
        .filter(field => field !== 'name')
        .map(field => {
          const checked = shown.includes(field)
          return {
            label: facetLabel(field, nonMetadataFieldSet),
            type: 'checkbox' as const,
            checked,
            onClick: () => {
              table.setColumnVisible(field, !checked)
            },
          }
        }),
    },
  ]
}
