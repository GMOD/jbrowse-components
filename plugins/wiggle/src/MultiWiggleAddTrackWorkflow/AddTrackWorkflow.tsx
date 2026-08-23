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
  Button,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import DropZone from './DropZone.tsx'
import {
  applyName,
  buildAdapterPayload,
  buildMultiWiggleTrackConf,
  canSubmit,
  itemToName,
  parseItems,
} from './util.ts'

import type { TrackItem } from './util.ts'
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
    marginBottom: 100,
    display: 'block',
  },
}))

interface TrackRow {
  id: string
  name: string
  item: TrackItem
}

function itemToRow(item: TrackItem): TrackRow {
  return { id: nanoid(), name: itemToName(item), item }
}

function doSubmit({
  trackName,
  tracks,
  model,
}: {
  tracks: TrackRow[]
  trackName: string
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
    conf: buildMultiWiggleTrackConf({
      name: trackName.trim(),
      assemblyNames: [assembly],
      adapter: buildAdapterPayload(tracks.map(t => applyName(t.item, t.name))),
    }),
  })
}

const MultiWiggleAddTrackWorkflow = observer(
  function MultiWiggleAddTrackWorkflow({
    model,
  }: {
    model: AddTrackWorkflowModel
  }) {
    const { classes } = useStyles()
    const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
    const [inputVal, setInputVal] = useState('')
    const [tracks, setTracks] = useState<TrackRow[]>([])
    const [trackName, setTrackName] = useState('MultiWiggle')
    const [selection, setSelection] = useState<GridRowSelectionModel>(() => ({
      type: 'include',
      ids: new Set(),
    }))

    function addTracks(items: TrackItem[]) {
      setTracks(prev => [...prev, ...items.map(itemToRow)])
    }

    // resolve here so the header "select all" (an exclude-type model) counts
    // every track rather than reading as an empty selection
    const selectedIds = resolveSelectedIds(
      selection,
      tracks.map(t => t.id),
    )

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
              placeholder="Paste a list of URLs (one per line) or a JSON array of subadapter configs, then click 'Add tracks'"
              variant="outlined"
              onChange={event => {
                setInputVal(event.target.value)
              }}
            />
            <Button
              variant="outlined"
              disabled={!inputVal.trim()}
              onClick={() => {
                addTracks(parseItems(inputVal))
                setInputVal('')
              }}
            >
              Add tracks
            </Button>
          </>
        ) : (
          <DropZone addTracks={addTracks} />
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
        <TextField
          value={trackName}
          helperText="Track name"
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
          disabled={!canSubmit({ tracks, trackName, assembly: model.assembly })}
          onClick={() => {
            try {
              doSubmit({ trackName, tracks, model })
            } catch (e) {
              getNotificationSink(model).notifyError(`${e}`, e)
            }
          }}
        >
          Submit
        </Button>
        <Typography variant="body2" color="textSecondary">
          The text box accepts a list of URLs (one per line), or a JSON array of
          subadapter configs like{' '}
          <code>{`[{"type":"BigWigAdapter","bigWigLocation":{"uri":"http://host/file.bw"}, "color":"green","source":"name for subtrack"}]`}</code>{' '}
          to set per-subtrack options such as color or source name.
        </Typography>
      </Paper>
    )
  },
)

export default MultiWiggleAddTrackWorkflow
