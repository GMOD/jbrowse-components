import { useState } from 'react'

import { ActionLink } from '@jbrowse/core/ui'
import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import PopoverPicker from '@jbrowse/core/ui/PopoverPicker'
import VirtualTable, {
  EditableTextCell,
  TableCheckbox,
} from '@jbrowse/core/ui/VirtualTable'
import { getSession } from '@jbrowse/core/util'
import {
  HIGHLIGHT_ALPHA,
  getHighlightColor,
} from '@jbrowse/core/util/highlights'
import { compareValues } from '@jbrowse/core/util/tableText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { colWidth, navToHighlight } from '../utils.ts'
import SelectionActions from './SelectionActions.tsx'

import type { GridBookmarkModel, HighlightRow } from '../model.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

const CHECKBOX_WIDTH = 40
const COLOR_WIDTH = 60

const useStyles = makeStyles()(theme => ({
  tableBox: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70vh',
  },
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  placeholder: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  // no height of its own, so the swatch overhangs the row rather than
  // growing it, and the cell clips it
  swatch: {
    display: 'flex',
    alignItems: 'center',
    height: 0,
  },
}))

const sortKeys: Record<string, (row: HighlightRow) => unknown> = {
  locString: row => row.locString,
  label: row => row.label,
  assemblyName: row => row.assemblyName,
  color: row => row.highlight.color,
}

const HighlightGrid = observer(function HighlightGrid({
  model,
}: {
  model: GridBookmarkModel
}) {
  const { classes } = useStyles()
  const theme = useStyleTheme()
  const session = getSession(model)
  const [sortField, setSortField] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  const { rows, selectedIds, selectedHighlights } = model
  const bandColor = (h: { color?: string }) =>
    getHighlightColor(h, theme).toRgbString()
  const assemblyNames = rows.map(r => r.assemblyName)
  const multipleAssemblies = new Set(assemblyNames).size > 1

  const sortKey = sortKeys[sortField]
  const direction = sortAscending ? 1 : -1
  const sortedRows = sortKey
    ? rows.toSorted((a, b) => compareValues(sortKey(a), sortKey(b), direction))
    : rows

  const columns: VirtualTableColumn<HighlightRow>[] = [
    {
      id: 'locString',
      header: 'Location',
      title: row => row.locString,
      cell: row => (
        <ActionLink
          className={classes.cell}
          onClick={() => {
            void navToHighlight(row.highlight, model)
          }}
        >
          {row.locString}
        </ActionLink>
      ),
    },
    {
      id: 'label',
      header: 'Label',
      fill: true,
      title: row => row.label,
      cell: row => (
        <EditableTextCell
          value={row.label}
          label={`Edit label of ${row.locString}`}
          allowBlank
          editOnClick
          onCommit={text => {
            session.updateHighlight(row.highlight, {
              label: text || undefined,
            })
          }}
        >
          {row.label || (
            <span className={classes.placeholder}>Add label...</span>
          )}
        </EditableTextCell>
      ),
    },
    ...(multipleAssemblies
      ? [
          {
            id: 'assemblyName',
            header: 'Assembly',
            title: (row: HighlightRow) => row.assemblyName,
            cell: (row: HighlightRow) => row.assemblyName,
          },
        ]
      : []),
    {
      id: 'color',
      header: 'Color',
      cell: row => (
        <div className={classes.swatch}>
          <PopoverPicker
            color={bandColor(row.highlight)}
            unset={!row.highlight.color}
            presetAlpha={HIGHLIGHT_ALPHA}
            onChange={color => {
              session.updateHighlight(row.highlight, { color })
            }}
          />
        </div>
      ),
    },
  ]

  const allSelected =
    rows.length > 0 && selectedHighlights.length === rows.length
  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    model.setSelectedIds(next)
  }

  return (
    <div>
      <SelectionActions
        count={selectedHighlights.length}
        color={bandColor(selectedHighlights[0] ?? {})}
        onDelete={() => {
          model.removeSelectedHighlights()
        }}
        onRecolor={color => {
          model.recolorSelectedHighlights(color)
        }}
      />
      <div className={classes.tableBox}>
        <VirtualTable
          rows={sortedRows}
          columns={columns}
          widths={() => ({
            locString: colWidth(
              'Location',
              rows.map(r => r.locString),
            ),
            assemblyName: colWidth('Assembly', assemblyNames),
            color: COLOR_WIDTH,
          })}
          sortField={sortField}
          sortAscending={sortAscending}
          onSort={(field, ascending) => {
            setSortField(field)
            setSortAscending(ascending)
          }}
          resetKey={JSON.stringify([sortField, sortAscending])}
          emptyMessage="No highlights yet. Drag across a view to highlight a region, or import from the menu."
          isRowSelected={row => selectedIds.has(row.id)}
          leading={{
            width: CHECKBOX_WIDTH,
            header: (
              <TableCheckbox
                checked={allSelected}
                indeterminate={selectedHighlights.length > 0 && !allSelected}
                label="Select all highlights"
                onChange={() => {
                  model.setSelectedIds(
                    new Set(allSelected ? [] : rows.map(r => r.id)),
                  )
                }}
              />
            ),
            cell: row => (
              <TableCheckbox
                checked={selectedIds.has(row.id)}
                label={`Select ${row.locString}`}
                onChange={() => {
                  toggle(row.id)
                }}
              />
            ),
          }}
          testId="highlight-table"
        />
      </div>
    </div>
  )
})

export default HighlightGrid
