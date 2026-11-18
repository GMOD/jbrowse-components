import { useState } from 'react'

import VirtualTable, { TableCheckbox } from '@jbrowse/core/ui/VirtualTable'
import { measureGridWidth } from '@jbrowse/core/util'
import { compareValues } from '@jbrowse/core/util/tableText'
import { useMediaQuery } from '@mui/material'
import { observer } from 'mobx-react'

import { NARROW_QUERY } from '../narrow.ts'
import DateSinceLastUsed from './DateSinceLastUsed.tsx'
import SessionNameCell from './SessionNameCell.tsx'
import { formatLastModified } from './formatLastModified.ts'

import type { RecentSessionData } from '../types.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'

interface SessionRow extends RecentSessionData {
  id: string
  lastModified: string
  lastModifiedTooltip?: string
}

const CHECKBOX_WIDTH = 50

const sortKeys: Record<string, (row: SessionRow) => unknown> = {
  name: row => row.name,
  path: row => row.path,
  lastModified: row => row.updated,
}

const RecentSessionsTable = observer(function RecentSessionsTable({
  launch,
  sessions,
  showPath,
  selectedPaths,
  setSelectedPaths,
  setSessionToRename,
  setSessionsToDelete,
  isFavorite,
  toggleFavorite,
  addToQuickstartList,
}: {
  launch: (path: string) => Promise<void>
  setSessionToRename: (arg: RecentSessionData) => void
  setSessionsToDelete: (arg: RecentSessionData[]) => void
  selectedPaths: ReadonlySet<string>
  setSelectedPaths: (arg: ReadonlySet<string>) => void
  sessions: RecentSessionData[]
  showPath: boolean
  isFavorite: (sessionPath: string) => boolean
  toggleFavorite: (sessionPath: string) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const [sortField, setSortField] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  // The same query the start screen stacks its panels at, so "narrow" here
  // means the table has the whole window and still not much of it. `noSsr`
  // because the default renders once with `false` before the real value: on a
  // narrow window that is a first paint of the wide column set.
  const narrow = useMediaQuery(NARROW_QUERY, { noSsr: true })

  const rows = sessions.map((session): SessionRow => {
    const { label, tooltip } = formatLastModified(session.updated)
    return {
      ...session,
      id: session.path,
      lastModified: label,
      lastModifiedTooltip: tooltip,
    }
  })
  const sortKey = sortKeys[sortField]
  const direction = sortAscending ? 1 : -1
  const sortedRows = sortKey
    ? rows.toSorted((a, b) => compareValues(sortKey(a), sortKey(b), direction))
    : rows

  const lastModifiedWidth =
    measureGridWidth(
      rows.map(r => r.lastModified),
      { stripHTML: true },
    ) + 40

  const columns: VirtualTableColumn<SessionRow>[] = [
    {
      id: 'name',
      header: 'Session name',
      fill: true,
      cell: row => (
        <SessionNameCell
          value={row.name}
          row={row}
          isFavorite={isFavorite(row.path)}
          launch={launch}
          toggleFavorite={toggleFavorite}
          setSessionToRename={setSessionToRename}
          setSessionsToDelete={setSessionsToDelete}
          addToQuickstartList={addToQuickstartList}
        />
      ),
    },
    // a path column narrow enough to fit shows "/home/user/jbrowse/sessi…" and
    // nothing the user can act on, so a narrow window spends the width on the
    // name instead; the row menu still names the file
    ...(showPath && !narrow
      ? [
          {
            id: 'path',
            header: 'Session path',
            title: (row: SessionRow) => row.path,
            cell: (row: SessionRow) => row.path,
          },
        ]
      : []),
    {
      id: 'lastModified',
      header: 'Last modified',
      cell: row => <DateSinceLastUsed row={row} />,
    },
  ]

  const allSelected =
    rows.length > 0 && rows.every(row => selectedPaths.has(row.path))
  const someSelected = rows.some(row => selectedPaths.has(row.path))
  const toggle = (path: string) => {
    const next = new Set(selectedPaths)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    setSelectedPaths(next)
  }

  return (
    <VirtualTable
      rows={sortedRows}
      columns={columns}
      widths={() => ({ name: 150, path: 200, lastModified: lastModifiedWidth })}
      sortField={sortField}
      sortAscending={sortAscending}
      onSort={(field, ascending) => {
        setSortField(field)
        setSortAscending(ascending)
      }}
      resetKey={JSON.stringify([sortField, sortAscending])}
      emptyMessage="No sessions"
      isRowSelected={narrow ? undefined : row => selectedPaths.has(row.path)}
      // 50px of checkbox for a multi-select whose two toolbar buttons the
      // panel hides at this width: every one of their actions is in the
      // row's own menu, and the name needs the space more
      leading={
        narrow
          ? undefined
          : {
              width: CHECKBOX_WIDTH,
              header: (
                <TableCheckbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  label="Select all sessions"
                  onChange={() => {
                    setSelectedPaths(
                      new Set(allSelected ? [] : rows.map(row => row.path)),
                    )
                  }}
                />
              ),
              cell: row => (
                <TableCheckbox
                  checked={selectedPaths.has(row.path)}
                  label={`Select ${row.name}`}
                  onChange={() => {
                    toggle(row.path)
                  }}
                />
              ),
            }
      }
      testId="recent-sessions-table"
    />
  )
})

export default RecentSessionsTable
