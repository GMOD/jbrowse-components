import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SanitizedHTML } from '@jbrowse/core/ui'
import Dialog from '@jbrowse/core/ui/Dialog'
import { measureGridWidth } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
  DialogContent,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ConfirmDialog = ({
  tracks: initialTracks,
  onClose,
}: {
  tracks: AnyConfigurationModel[]
  onClose: (
    arg: boolean,
    arg1?: { name: string; tracks: AnyConfigurationModel[] },
  ) => void
}) => {
  const [val, setVal] = useState(() => `MultiWiggle ${Date.now()}`)
  const [tracks, setTracks] = useState(initialTracks)
  const allQuant = tracks.every(t => t.type === 'QuantitativeTrack')
  return (
    <Dialog
      open
      onClose={() => {
        onClose(false)
      }}
      title="Confirm multi-wiggle track create"
    >
      <DialogContent>
        {!allQuant ? (
          <Typography>
            Not every track looks like a QuantitativeTrack. This could have
            unexpected behavior, confirm if it looks ok.
          </Typography>
        ) : null}
        <Typography>Listing:</Typography>
        <DataGrid
          autoHeight
          rows={tracks}
          getRowId={row => row.trackId}
          columns={[
            {
              field: 'name',
              headerName: 'Name',
              width: measureGridWidth(
                tracks.map(t => readConfObject(t, 'name')),
              ),
              renderCell: ({ row }) => (
                <SanitizedHTML html={readConfObject(row, 'name')} />
              ),
            },
            {
              field: 'type',
              headerName: 'Type',
              width: measureGridWidth(tracks.map(t => t.type)),
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
                    setTracks(prev =>
                      prev.filter(t => t.trackId !== row.trackId),
                    )
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
          helperText="Track name"
        />
        <Typography>Confirm creation of track?</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose(false)
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            onClose(true, { name: val, tracks })
          }}
          color="primary"
          variant="contained"
          autoFocus
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmDialog
