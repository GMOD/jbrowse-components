import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import {
  fileToLocation,
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, Paper, TextField, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import {
  addMultiWiggleTrack,
  applyName,
  buildAdapterPayload,
  canSubmit,
  itemToName,
  parseItems,
} from './util.ts'

import type { TrackItem } from './util.ts'
import type { AddTrackModel } from '@jbrowse/plugin-data-management'
import type { GridRowSelectionModel } from '@mui/x-data-grid'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
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
  model: AddTrackModel
}) {
  const session = getSession(model)
  const { assembly } = model
  if (assembly && isSessionWithAddTracks(session)) {
    addMultiWiggleTrack({
      session,
      view: model.view,
      name: trackName,
      assemblyNames: [assembly],
      adapter: buildAdapterPayload(tracks.map(t => applyName(t.item, t.name))),
    })
  }
  model.clearData()
  if (isSessionModelWithWidgets(session)) {
    session.hideWidget(model)
  }
}

const MultiWiggleAddTrackWorkflow = observer(
  function MultiWiggleAddTrackWorkflow({ model }: { model: AddTrackModel }) {
    const { classes } = useStyles()
    const [inputVal, setInputVal] = useState('')
    const [tracks, setTracks] = useState<TrackRow[]>([])
    const [trackName, setTrackName] = useState('MultiWiggle')
    const [selection, setSelection] = useState<GridRowSelectionModel>({
      type: 'include',
      ids: new Set(),
    })

    function addTracks(items: TrackItem[]) {
      setTracks(prev => [...prev, ...items.map(itemToRow)])
    }

    return (
      <Paper className={classes.paper}>
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
        <Button variant="outlined" component="label">
          Choose Files from your computer
          <input
            type="file"
            hidden
            multiple
            onChange={({ target }) => {
              addTracks(
                [...(target.files ?? [])].map(file => ({
                  type: 'BigWigAdapter',
                  bigWigLocation: fileToLocation(file),
                  source: file.name,
                })),
              )
              target.value = ''
            }}
          />
        </Button>
        {tracks.length > 0 ? (
          <div style={{ marginTop: 8 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DeleteIcon />}
              disabled={selection.ids.size === 0}
              onClick={() => {
                setTracks(prev => prev.filter(t => !selection.ids.has(t.id)))
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
                  getSession(model).notifyError(`${e}`, e)
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
        <Button
          variant="contained"
          className={classes.submit}
          disabled={!canSubmit({ tracks, trackName, assembly: model.assembly })}
          onClick={() => {
            try {
              doSubmit({ trackName, tracks, model })
            } catch (e) {
              getSession(model).notifyError(`${e}`, e)
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
