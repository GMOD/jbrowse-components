import { useState } from 'react'

import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { Button, Paper, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

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

// on electron, use path to LocalFileLocation, on web, use the BlobLocation
function makeFileLocation(file: File) {
  return isElectron
    ? {
        localPath: window.require('electron').webUtils.getPathForFile(file),
        locationType: 'LocalPathLocation',
      }
    : storeBlobLocation({ blob: file })
}

function doSubmit({
  trackName,
  val,
  model,
}: {
  val: string
  trackName: string
  model: AddTrackModel
}) {
  const session = getSession(model)
  try {
    const trackId = [
      `${trackName.toLowerCase().replaceAll(' ', '_')}-${Date.now()}`,
      session.adminMode ? '' : '-sessionTrack',
    ].join('')

    // allow list of bigwigs in JSON format or line-by-line
    let bigWigs: unknown[]
    try {
      bigWigs = JSON.parse(val)
    } catch (e) {
      bigWigs = val
        .split(/\n|\r\n|\r/)
        .map(f => f.trim())
        .filter(f => !!f)
    }
    const obj =
      typeof bigWigs[0] === 'string' ? { bigWigs } : { subadapters: bigWigs }

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

const MultiWiggleAddTrackWorkflow = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  const [trackName, setTrackName] = useState(`MultiWiggle${Date.now()}`)
  return (
    <Paper className={classes.paper}>
      <ul>
        <li>Enter list of URLs for bigwig files in the textbox</li>
        <li>
          Or, use the button below the text box to select files from your
          computer
        </li>
      </ul>
      <TextField
        multiline
        fullWidth
        rows={10}
        value={val}
        placeholder="Paste list of URLs here, or use file selector below"
        variant="outlined"
        onChange={event => {
          setVal(event.target.value)
        }}
      />
      <Button variant="outlined" component="label">
        Choose Files from your computer
        <input
          type="file"
          hidden
          multiple
          onChange={({ target }) => {
            setVal(
              JSON.stringify(
                [...(target.files || [])].map(file => ({
                  type: 'BigWigAdapter',
                  bigWigLocation: makeFileLocation(file),
                  source: file.name,
                })),
                null,
                2,
              ),
            )
          }}
        />
      </Button>
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
        onClick={() => {
          doSubmit({ trackName, val, model })
        }}
      >
        Submit
      </Button>
      <p>Additional notes: </p>
      <ul>
        <li>
          The list of bigwig files in the text box can be a list of URLs, or a
          list of elements like{' '}
          <code>{`[{"type":"BigWigAdapter","bigWigLocation":{"uri":"http://host/file.bw"}, "color":"green","source":"name for subtrack"}]`}</code>{' '}
          to apply e.g. the color attribute to the view
        </li>
        <li>
          Adding local files will update the textbox with JSON contents that are
          ready to submit with the "Submit" button
        </li>
      </ul>
    </Paper>
  )
})

export default MultiWiggleAddTrackWorkflow
