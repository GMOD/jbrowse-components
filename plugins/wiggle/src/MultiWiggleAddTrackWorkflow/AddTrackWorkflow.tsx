import { useRef, useState } from 'react'

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
import { Button, IconButton, Paper, TextField } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '@jbrowse/plugin-data-management'

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

type TrackItem = string | Record<string, unknown>

interface TrackRow {
  id: string
  name: string
  item: TrackItem
}

function makeFileLocation(file: File) {
  return isElectron
    ? {
        localPath: window.require('electron').webUtils.getPathForFile(file),
        locationType: 'LocalPathLocation',
      }
    : storeBlobLocation({ blob: file })
}

function parseItems(val: string): TrackItem[] {
  try {
    return JSON.parse(val) as TrackItem[]
  } catch (e) {
    return val
      .split(/\n|\r\n|\r/)
      .map(f => f.trim())
      .filter(Boolean)
  }
}

function itemToRow(item: TrackItem, id: string): TrackRow {
  const name =
    typeof item === 'string'
      ? item
      : String((item.source ?? item.name) || 'unnamed')
  return { id, name, item }
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
  try {
    const trackId = `${trackName.toLowerCase().replaceAll(' ', '_')}-${Date.now()}${session.adminMode ? '' : '-sessionTrack'}`

    const items = tracks.map(t => t.item)
    const obj =
      typeof items[0] === 'string'
        ? { bigWigs: items }
        : { subadapters: items }

    if (isSessionWithAddTracks(session)) {
      session.addTrackConf({
        trackId,
        type: 'MultiQuantitativeTrack',
        name: trackName,
        assemblyNames: [model.assembly],
        adapter: {
          type: 'MultiWiggleAdapter',
          ...obj,
        },
      })

      model.view?.showTrack(trackId)
    }
    model.clearData()
    if (isSessionModelWithWidgets(session)) {
      session.hideWidget(model)
    }
  } catch (e) {
    console.error(e)
    session.notifyError(`${e}`, e)
  }
}

const MultiWiggleAddTrackWorkflow = observer(
  function MultiWiggleAddTrackWorkflow({ model }: { model: AddTrackModel }) {
    const { classes } = useStyles()
    const [inputVal, setInputVal] = useState('')
    const [tracks, setTracks] = useState<TrackRow[]>([])
    const [trackName, setTrackName] = useState(`MultiWiggle${Date.now()}`)
    const counter = useRef(0)

    function addTracks(items: TrackItem[]) {
      setTracks(prev => [
        ...prev,
        ...items.map(item => itemToRow(item, String(counter.current++))),
      ])
    }

    return (
      <Paper className={classes.paper}>
        <TextField
          multiline
          fullWidth
          rows={5}
          value={inputVal}
          placeholder="Paste list of URLs here, then click 'Add tracks'"
          variant="outlined"
          onChange={event => {
            setInputVal(event.target.value)
          }}
        />
        <Button
          variant="outlined"
          onClick={() => {
            if (inputVal.trim()) {
              addTracks(parseItems(inputVal))
              setInputVal('')
            }
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
                [...(target.files || [])].map(file => ({
                  type: 'BigWigAdapter',
                  bigWigLocation: makeFileLocation(file),
                  source: file.name,
                })),
              )
            }}
          />
        </Button>
        {tracks.length > 0 ? (
          <div style={{ height: 300, width: '100%', marginTop: 8 }}>
            <DataGrid
              rows={tracks}
              columns={[
                {
                  field: 'name',
                  headerName: 'Name',
                  flex: 1,
                  renderCell: ({ value }) => <SanitizedHTML html={value} />,
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
                        setTracks(prev => prev.filter(t => t.id !== row.id))
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
          disabled={!tracks.length}
          onClick={() => {
            doSubmit({ trackName, tracks, model })
          }}
        >
          Submit
        </Button>
        <p>
          The list of bigwig files in the text box can be a list of URLs, or a
          list of elements like{' '}
          <code>{`[{"type":"BigWigAdapter","bigWigLocation":{"uri":"http://host/file.bw"}, "color":"green","source":"name for subtrack"}]`}</code>{' '}
          to apply e.g. the color attribute to the view
        </p>
      </Paper>
    )
  },
)

export default MultiWiggleAddTrackWorkflow
