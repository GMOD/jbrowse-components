import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SanitizedHTML, SubmitDialog } from '@jbrowse/core/ui'
import { measureGridWidth } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import { Alert, IconButton, TextField } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import {
  MIXED_MESSAGE,
  stackKind,
  stackKindOf,
} from '../MultiWiggleAddTrackWorkflow/util.ts'

import type { StackKind } from '../MultiWiggleAddTrackWorkflow/util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ConfirmDialog = ({
  tracks: initialTracks,
  leftOut,
  onClose,
}: {
  tracks: AnyConfigurationModel[]
  leftOut: AnyConfigurationModel[]
  onClose: (result?: {
    name: string
    tracks: AnyConfigurationModel[]
    kind: StackKind
  }) => void
}) => {
  const [val, setVal] = useState('Multi-row track')
  const [tracks, setTracks] = useState(initialTracks)
  const kind = stackKind(tracks.flatMap(t => stackKindOf(t.type) ?? []))
  return (
    <SubmitDialog
      open
      title="Create multi-row track"
      submitDisabled={!kind || kind === 'mixed' || !val.trim()}
      onCancel={() => {
        onClose()
      }}
      onSubmit={() => {
        if (kind === 'quantitative' || kind === 'feature') {
          onClose({ name: val.trim(), tracks, kind })
        }
      }}
    >
      {leftOut.length > 0 ? (
        <Alert severity="warning">
          Left out, since only quantitative and feature tracks stack:{' '}
          {leftOut.map(t => readConfObject(t, 'name')).join(', ')}
        </Alert>
      ) : null}
      {kind === 'mixed' ? (
        <Alert severity="error">{MIXED_MESSAGE}</Alert>
      ) : null}
      <DataGrid
        autoHeight
        rows={tracks}
        getRowId={row => row.trackId}
        columns={[
          {
            field: 'name',
            headerName: 'Name',
            width: measureGridWidth(tracks.map(t => readConfObject(t, 'name'))),
            renderCell: ({ row }) => (
              <SanitizedHTML html={readConfObject(row, 'name')} />
            ),
          },
          {
            field: 'remove',
            headerName: '',
            width: 50,
            sortable: false,
            renderCell: ({ row }) => (
              <IconButton
                size="small"
                onClick={() => {
                  setTracks(prev => prev.filter(t => t.trackId !== row.trackId))
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            ),
          },
        ]}
        rowHeight={25}
        columnHeaderHeight={33}
        hideFooter
      />
      <TextField
        value={val}
        onChange={event => {
          setVal(event.target.value)
        }}
        label="Track name"
      />
    </SubmitDialog>
  )
}

export default ConfirmDialog
