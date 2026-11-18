import { useState } from 'react'

import VirtualTable, { TableCheckbox } from '@jbrowse/core/ui/VirtualTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { extraColumns } from '../rows/rowFields.ts'
import BulkColorControls from './BulkColorControls.tsx'
import SelectionMoveButtons from './SelectionMoveButtons.tsx'
import { buildSourceColumns } from './buildSourceColumns.tsx'
import { useSourceSort } from './useSourceSort.ts'

import type { EachRowPicks } from './buildSourceColumns.tsx'

const CHECKBOX_WIDTH = 50

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // no height of its own, so the swatch overhangs a row rather than growing
  // it, and the cell clips it
  swatch: {
    display: 'flex',
    alignItems: 'center',
    height: 0,
  },
})

export default observer(function SourceGrid<S extends { name: string }>({
  rows,
  onChange,
  colors,
  eachRow,
  reserved,
}: {
  rows: S[]
  onChange: (arg: S[]) => void
  // The color each row shows, by name.
  colors: ReadonlyMap<string, string>
  // The colors pinned on rows, which a row's swatch and the bulk color
  // controls set.
  eachRow: EachRowPicks
  // Fields that drive their own dedicated column or are plumbing, so they must
  // not appear in the auto-derived extras.
  reserved: ReadonlySet<string>
}) {
  const { classes } = useStyles()
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const sortBy = useSourceSort(rows, onChange)
  const extras = extraColumns(rows, reserved)
  const columns = buildSourceColumns({
    colors,
    eachRow,
    extras,
    rows,
    cellClassName: classes.cell,
    swatchClassName: classes.swatch,
  })
  const widths = Object.fromEntries(columns.map(col => [col.id, col.width]))
  const selected = rows.filter(r => ticked.has(r.name)).map(r => r.name)
  const allSelected = rows.length > 0 && selected.length === rows.length

  return (
    <div>
      <BulkColorControls selected={selected} onPick={eachRow.onPick} />
      <SelectionMoveButtons
        rows={rows}
        selected={selected}
        onChange={onChange}
      />
      <div style={{ height: 400, width: '100%' }}>
        <VirtualTable
          rows={rows.map(source => ({ id: source.name, source }))}
          columns={columns}
          widths={() => widths}
          // the header click reorders the rows themselves, so no column
          // shows a sort
          sortField=""
          sortAscending
          onSort={field => {
            sortBy(field)
          }}
          resetKey=""
          emptyMessage="No rows"
          isRowSelected={({ id }) => ticked.has(id)}
          leading={{
            width: CHECKBOX_WIDTH,
            header: (
              <TableCheckbox
                checked={allSelected}
                indeterminate={selected.length > 0 && !allSelected}
                label="Select all rows"
                onChange={() => {
                  setTicked(new Set(allSelected ? [] : rows.map(r => r.name)))
                }}
              />
            ),
            cell: ({ id }) => (
              <TableCheckbox
                checked={ticked.has(id)}
                label={`Select ${id}`}
                onChange={() => {
                  const next = new Set(ticked)
                  if (next.has(id)) {
                    next.delete(id)
                  } else {
                    next.add(id)
                  }
                  setTicked(next)
                }}
              />
            ),
          }}
          testId="row-arrangement-rows"
        />
      </div>
    </div>
  )
})
