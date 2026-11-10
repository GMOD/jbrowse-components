import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip, useMediaQuery } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import { NARROW_QUERY } from '../narrow.ts'
import DateSinceLastUsed from './DateSinceLastUsed.tsx'
import SessionNameCell from './SessionNameCell.tsx'
import { formatLastModified } from './formatLastModified.ts'
import { selectedFromModel } from './selectedFromModel.ts'

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

const RecentSessionsDataGrid = observer(function RecentSessionsDataGrid({
  launch,
  sessions,
  showPath,
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
  showPath: boolean
  isFavorite: (sessionPath: string) => boolean
  toggleFavorite: (sessionPath: string) => void
  addToQuickstartList?: (entry: RecentSessionData) => Promise<void>
}) {
  const { classes } = useStyles()
  // The same query the start screen stacks its panels at, so "narrow" here
  // means the grid has the whole window and still not much of it. `noSsr`
  // because the default renders once with `false` before the real value: on a
  // narrow window that is a first paint of the wide column set.
  const narrow = useMediaQuery(NARROW_QUERY, { noSsr: true })

  const rows = sessions.map(session => {
    const { label, tooltip } = formatLastModified(session.updated)
    return { ...session, lastModified: label, lastModifiedTooltip: tooltip }
  })

  const lastModifiedWidth =
    measureGridWidth(
      rows.map(r => r.lastModified),
      { stripHTML: true },
    ) + 40

  const columns = [
    {
      field: 'name',
      headerName: 'Session name',
      flex: 1,
      minWidth: 150,
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
    // a path column narrow enough to fit shows "/home/user/jbrowse/sessi…" and
    // nothing the user can act on, so a narrow window spends the width on the
    // name instead; the row menu still names the file
    ...(showPath && !narrow
      ? [
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
        ]
      : []),
    {
      field: 'lastModified',
      headerName: 'Last modified',
      width: lastModifiedWidth,
      // sort/filter on the numeric timestamp, not the formatted label (which
      // would order "a minute ago" before "2 days ago" alphabetically)
      valueGetter: (_value: unknown, row: RecentSessionData) => row.updated,
      renderCell: ({ row }: GridRenderCellParams) => (
        <DateSinceLastUsed row={row} />
      ),
    },
  ]

  return (
    <DataGridFlexContainer>
      <DataGrid
        // 50px of checkbox for a multi-select whose two toolbar buttons the
        // panel hides at this width: every one of their actions is in the row's
        // own menu, and the name needs the space more
        checkboxSelection={!narrow}
        disableRowSelectionOnClick
        hideFooter={rows.length <= 100}
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
  )
})

export default RecentSessionsDataGrid
