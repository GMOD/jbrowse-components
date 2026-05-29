import { useState } from 'react'

import { SanitizedHTML } from '@jbrowse/core/ui'
import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import { Button, Paper, TextField, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import {
  buildAdapterPayload,
  canSubmit,
  itemToName,
  makeTrackId,
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

function makeFileLocation(file: File) {
  return isElectron
    ? {
        // @ts-ignore - electron injects require onto window, needs to be ignore not expect-error for now
        localPath: window.require('electron').webUtils.getPathForFile(file),
        locationType: 'LocalPathLocation',
      }
    : storeBlobLocation({ blob: file })
}

function itemToRow(item: TrackItem): TrackRow {
  return { id: crypto.randomUUID(), name: itemToName(item), item }
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
  const trackId = makeTrackId(trackName, !!session.adminMode)

  if (isSessionWithAddTracks(session)) {
    session.addTrackConf({
      trackId,
      type: 'MultiQuantitativeTrack',
      name: trackName,
      assemblyNames: [model.assembly],
      adapter: {
        type: 'MultiWiggleAdapter',
        ...buildAdapterPayload(tracks.map(t => t.item)),
      },
    })

    model.view?.showTrack(trackId)
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
                  bigWigLocation: makeFileLocation(file),
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
                    renderCell: ({ value }) => <SanitizedHTML html={value} />,
                  },
                ]}
                rowHeight={25}
                columnHeaderHeight={33}
                hideFooter
                checkboxSelection
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
          The list of bigwig files in the text box can be a list of URLs, or a
          list of elements like{' '}
          <code>{`[{"type":"BigWigAdapter","bigWigLocation":{"uri":"http://host/file.bw"}, "color":"green","source":"name for subtrack"}]`}</code>{' '}
          to apply e.g. the color attribute to the view
        </Typography>
      </Paper>
    )
  },
)

export default MultiWiggleAddTrackWorkflow
