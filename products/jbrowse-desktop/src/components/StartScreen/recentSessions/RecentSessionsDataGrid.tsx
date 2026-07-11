import { useState } from 'react'

import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import DateSinceLastUsed from './DateSinceLastUsed.tsx'
import SessionNameCell from './SessionNameCell.tsx'
import { formatLastModified } from './formatLastModified.ts'
import { selectedFromModel } from './selectedFromModel.ts'
import { useInnerDims } from '../availableGenomes/util.ts'

import type { RecentSessionData } from '../types.ts'
import type {
  GridRenderCellParams,
  GridRowSelectionModel,
} from '@mui/x-data-grid'

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

function RecentSessionsDataGrid({
  launch,
  sessions,
  setSelectedSessions,
  setSessionToRename,
  setSessionsToDelete,
  isFavorite,
  toggleFavorite,
  addToQuickstartList,
}: {
  launch: (path: string) => Promise<void>
  setSessionToRename: (arg: RecentSessionData) => void
  setSessionsToDelete: (arg: RecentSessionData[]) => void
  setSelectedSessions: (arg: RecentSessionData[]) => void
  sessions: RecentSessionData[]
  isFavorite: (sessionPath: string) => boolean
  toggleFavorite: (sessionPath: string) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()
  const { height: innerHeight } = useInnerDims()
  const [now] = useState(() => Date.now())

  const rows = sessions.map(session => {
    const { label, tooltip } = formatLastModified(session.updated, now)
    return { ...session, lastModified: label, lastModifiedTooltip: tooltip }
  })

  const nameWidth =
    measureGridWidth(
      rows.map(r => r.name),
      { stripHTML: true },
    ) + 40
  const lastModifiedWidth =
    measureGridWidth(
      rows.map(r => r.lastModified),
      { stripHTML: true },
    ) + 40

  const columns = [
    {
      field: 'name',
      headerName: 'Session name',
      width: nameWidth,
      renderCell: ({ value, row }: GridRenderCellParams) => (
        <SessionNameCell
          value={String(value)}
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
    {
      field: 'path',
      headerName: 'Session path',
      width: 200,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Tooltip title={String(value)}>
          <div className={classes.cell}>{String(value)}</div>
        </Tooltip>
      ),
    },
    {
      field: 'lastModified',
      headerName: 'Last modified',
      width: lastModifiedWidth,
      // sort/filter on the numeric timestamp, not the formatted label (which
      // would order "a minute ago" before "2 days ago" alphabetically)
      valueGetter: (_value: unknown, row: RecentSessionData) =>
        row.updated ?? 0,
      renderCell: ({ row }: GridRenderCellParams) => (
        <DateSinceLastUsed row={row} />
      ),
    },
  ]

  return (
    <div style={{ maxHeight: innerHeight / 2, overflow: 'auto' }}>
      <DataGridFlexContainer>
        <DataGrid
          checkboxSelection
          disableRowSelectionOnClick
          getRowId={row => row.path}
          onRowSelectionModelChange={(model: GridRowSelectionModel) => {
            setSelectedSessions(selectedFromModel(model, sessions))
          }}
          rows={rows}
          rowHeight={25}
          columnHeaderHeight={33}
          columns={columns}
        />
      </DataGridFlexContainer>
    </div>
  )
}

export default RecentSessionsDataGrid
