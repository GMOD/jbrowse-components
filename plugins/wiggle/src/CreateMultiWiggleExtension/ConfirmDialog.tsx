import { useState } from 'react'

import { SanitizedHTML, SubmitDialog } from '@jbrowse/core/ui'
import DetailTable from '@jbrowse/core/ui/DetailTable'
import { coarseStripHTML } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import { Alert, IconButton, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  MIXED_MESSAGE,
  stackAssemblies,
  stackKind,
  stackKindOf,
  trackNameOf,
} from '../MultiWiggleAddTrackWorkflow/util.ts'

import type { StackKind } from '../MultiWiggleAddTrackWorkflow/util.ts'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'
import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'

interface TrackRow {
  id: string
  name: string
}

const useStyles = makeStyles()({
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    padding: 0,
  },
})

const ConfirmDialog = observer(function ConfirmDialog({
  tracks: initialTracks,
  leftOut,
  assemblyManager,
  onClose,
}: {
  tracks: AnyTrackConfig[]
  leftOut: AnyTrackConfig[]
  assemblyManager: AssemblyNameResolver
  onClose: (result?: {
    name: string
    tracks: AnyTrackConfig[]
    kind: StackKind
  }) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('Multi-row track')
  const [tracks, setTracks] = useState(initialTracks)
  const kind = stackKind(tracks.flatMap(t => stackKindOf(t.type) ?? []))
  const { assemblyNames, shared } = stackAssemblies(tracks, assemblyManager)
  const rows = tracks.map((track): TrackRow => ({
    id: track.trackId,
    name: trackNameOf(track),
  }))
  const columns: DetailTableColumn<TrackRow>[] = [
    {
      field: 'name',
      header: 'Name',
      value: row => coarseStripHTML(row.name),
      cell: row => (
        <div className={classes.nameCell}>
          <SanitizedHTML html={row.name} />
          <IconButton
            size="small"
            className={classes.button}
            aria-label={`Remove ${coarseStripHTML(row.name)}`}
            onClick={() => {
              setTracks(prev => prev.filter(t => t.trackId !== row.id))
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </div>
      ),
    },
  ]
  return (
    <SubmitDialog
      open
      title="Create multi-row track"
      submitDisabled={!kind || kind === 'mixed' || !shared || !val.trim()}
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
          {leftOut.map(t => trackNameOf(t)).join(', ')}
        </Alert>
      ) : null}
      {kind === 'mixed' ? (
        <Alert severity="error">{MIXED_MESSAGE}</Alert>
      ) : null}
      {shared ? null : (
        <Alert severity="error">
          Tracks on different assemblies do not stack (
          {assemblyNames.join(', ')}); remove all but one
        </Alert>
      )}
      <DetailTable rows={rows} columns={columns} testId="multi-row-tracks" />
      <TextField
        value={val}
        onChange={event => {
          setVal(event.target.value)
        }}
        label="Track name"
      />
    </SubmitDialog>
  )
})

export default ConfirmDialog
