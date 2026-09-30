import { useState } from 'react'

import { AssemblySelector, SanitizedHTML } from '@jbrowse/core/ui'
import {
  addTrackFromWidget,
  getNotificationSink,
  getSession,
  resolveSelectedIds,
} from '@jbrowse/core/util'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  Button,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import DropZone from './DropZone.tsx'
import {
  MIXED_MESSAGE,
  applyName,
  buildAdapterPayload,
  buildMultiRowTrackConf,
  canSubmit,
  classifyItem,
  parseItems,
  partition,
  sessionGuessers,
  stackKind,
} from './util.ts'

import type { Member, Refusal, StackKind } from './util.ts'
import type { AddTrackWorkflowModel } from '@jbrowse/core/util'
import type { GridRowSelectionModel } from '@mui/x-data-grid'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
  },
  toggle: {
    marginBottom: theme.spacing(),
  },
  submit: {
    marginTop: 25,
    display: 'block',
  },
}))

interface TrackRow {
  id: string
  name: string
  member: Member
}

function memberToRow(member: Member): TrackRow {
  return { id: nanoid(), name: member.name, member }
}

const KIND_LABEL: Record<StackKind, string> = {
  quantitative: 'quantitative',
  feature: 'features',
}

const PASTE_HELP =
  'One URL per line. BigWig and bedGraph files stack as quantitative rows, BED and BigBed files as feature rows. A JSON array of subadapter configs sets a row\'s color or name, e.g. [{"type":"BigWigAdapter","bigWigLocation":{"uri":"https://host/file.bw"},"color":"green","source":"sample 1"}]'

function doSubmit({
  trackName,
  tracks,
  kind,
  model,
}: {
  tracks: TrackRow[]
  trackName: string
  kind: StackKind
  model: AddTrackWorkflowModel
}) {
  const { assembly } = model
  if (!assembly) {
    throw new Error('Please choose an assembly')
  }
  // addTrackFromWidget tears the form down only once the track actually landed,
  // so a failure leaves the user's input intact to retry
  addTrackFromWidget({
    model,
    session: getSession(model),
    conf: buildMultiRowTrackConf({
      name: trackName.trim(),
      assemblyNames: [assembly],
      adapter: buildAdapterPayload(
        tracks.map(t => applyName(t.member, t.name)),
      ),
      kind,
    }),
  })
}

const MultiRowAddTrackWorkflow = observer(function MultiRowAddTrackWorkflow({
  model,
}: {
  model: AddTrackWorkflowModel
}) {
  const { classes } = useStyles()
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [inputVal, setInputVal] = useState('')
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [refusals, setRefusals] = useState<Refusal[]>([])
  const [trackName, setTrackName] = useState('Multi-row track')
  const guessers = sessionGuessers(model)
  const [selection, setSelection] = useState<GridRowSelectionModel>(() => ({
    type: 'include',
    ids: new Set(),
  }))

  function addClassified(classified: (Member | Refusal)[]) {
    const added = partition(classified)
    setTracks(prev => [...prev, ...added.members.map(memberToRow)])
    setRefusals(added.refusals)
  }

  // resolve here so the header "select all" (an exclude-type model) counts
  // every track rather than reading as an empty selection
  const selectedIds = resolveSelectedIds(
    selection,
    tracks.map(t => t.id),
  )
  const pending = partition(
    inputVal.trim()
      ? parseItems(inputVal).map(item => classifyItem(item, guessers))
      : [],
  )
  const allTracks = [...tracks, ...pending.members.map(memberToRow)]
  const kind = stackKind(allTracks.map(t => t.member.kind))
  const refusalLines = [
    ...new Set(
      [...refusals, ...pending.refusals].map(r => `${r.name}: ${r.reason}`),
    ),
  ]

  return (
    <Paper
      className={classes.paper}
      onDragEnter={event => {
        if (event.dataTransfer.types.includes('Files')) {
          setInputMode('upload')
        }
      }}
    >
      <ToggleButtonGroup
        className={classes.toggle}
        color="primary"
        size="small"
        exclusive
        value={inputMode}
        onChange={(_event, val) => {
          if (val) {
            setInputMode(val)
          }
        }}
      >
        <ToggleButton value="paste">Paste list of files</ToggleButton>
        <ToggleButton value="upload">Drag and drop files</ToggleButton>
      </ToggleButtonGroup>
      {inputMode === 'paste' ? (
        <>
          <TextField
            multiline
            fullWidth
            rows={5}
            value={inputVal}
            placeholder="https://host/sample1.bw"
            helperText={PASTE_HELP}
            variant="outlined"
            onChange={event => {
              setInputVal(event.target.value)
            }}
          />
          <Button
            variant="outlined"
            disabled={!inputVal.trim()}
            onClick={() => {
              addClassified(
                parseItems(inputVal).map(item => classifyItem(item, guessers)),
              )
              setInputVal('')
            }}
          >
            Add tracks
          </Button>
        </>
      ) : (
        <DropZone guessers={guessers} addClassified={addClassified} />
      )}
      {tracks.length > 0 ? (
        <div style={{ marginTop: 8 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteIcon />}
            disabled={selectedIds.size === 0}
            onClick={() => {
              setTracks(prev => prev.filter(t => !selectedIds.has(t.id)))
              setSelection({ type: 'include', ids: new Set() })
            }}
          >
            Delete selected
          </Button>
          <div style={{ height: 300, width: '100%', marginTop: 4 }}>
            <DataGrid
              rows={tracks}
              columns={[
                {
                  field: 'name',
                  headerName: 'Name',
                  flex: 1,
                  editable: true,
                  renderCell: ({ value }) => <SanitizedHTML html={value} />,
                },
                {
                  field: 'kind',
                  headerName: 'Data',
                  width: 110,
                  valueGetter: (_value, row) => KIND_LABEL[row.member.kind],
                },
              ]}
              rowHeight={25}
              columnHeaderHeight={33}
              hideFooter
              checkboxSelection
              disableRowSelectionOnClick
              processRowUpdate={newRow => {
                setTracks(prev =>
                  prev.map(t =>
                    t.id === newRow.id ? { ...t, name: newRow.name } : t,
                  ),
                )
                return newRow
              }}
              onProcessRowUpdateError={e => {
                getNotificationSink(model).notifyError(`${e}`, e)
              }}
              rowSelectionModel={selection}
              onRowSelectionModelChange={setSelection}
            />
          </div>
        </div>
      ) : null}
      {refusalLines.length > 0 ? (
        <Alert severity="warning" style={{ marginTop: 8 }}>
          Left out:
          <ul style={{ margin: 0 }}>
            {refusalLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {kind === 'mixed' ? (
        <Alert severity="error" style={{ marginTop: 8 }}>
          {MIXED_MESSAGE}
        </Alert>
      ) : null}
      <TextField
        value={trackName}
        label="Track name"
        onChange={event => {
          setTrackName(event.target.value)
        }}
      />
      <AssemblySelector
        session={getSession(model)}
        helperText="Select assembly to add track to"
        selected={model.assembly}
        onChange={arg => {
          model.setAssembly(arg)
        }}
        fullWidth
      />
      <Button
        variant="contained"
        className={classes.submit}
        disabled={!canSubmit({ kind, trackName, assembly: model.assembly })}
        onClick={() => {
          try {
            if (kind === 'quantitative' || kind === 'feature') {
              doSubmit({ trackName, tracks: allTracks, kind, model })
            }
          } catch (e) {
            getNotificationSink(model).notifyError(`${e}`, e)
          }
        }}
      >
        Submit
      </Button>
    </Paper>
  )
})

export default MultiRowAddTrackWorkflow
