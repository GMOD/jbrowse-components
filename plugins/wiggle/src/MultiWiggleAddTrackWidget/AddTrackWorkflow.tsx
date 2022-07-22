import React, { useState } from 'react'
import { Button, Paper, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { AddTrackModel } from '@jbrowse/plugin-data-management'

// locals
import Dropzone from './Dropzone'

const useStyles = makeStyles()(theme => ({
  textbox: {
    width: '100%',
  },
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
  },
  submit: {
    marginTop: 25,
    marginBottom: 100,
  },
}))

export default function MultiWiggleWidget({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  const [trackName, setTrackName] = useState('MultiWiggle ' + Date.now())
  return (
    <Paper className={classes.paper}>
      <ul>
        <li>Enter list of URLs for bigwig files in the textbox</li>
        <li>
          Or, drag and drop local files from your filesystem to the drop box
        </li>
      </ul>

      <TextField
        multiline
        rows={10}
        value={val}
        onChange={event => setVal(event.target.value)}
        variant="outlined"
        className={classes.textbox}
      />
      <Dropzone
        setAcceptedFiles={acceptedFiles => {
          const res = acceptedFiles.map(file => ({
            type: 'BigWigAdapter',
            bigWigLocation: storeBlobLocation({ blob: file }),
            source: file.name,
          }))
          setVal(JSON.stringify(res, null, 2))
        }}
      />

      <TextField
        value={trackName}
        onChange={event => setTrackName(event.target.value)}
        helperText="Track name"
      />

      <Button
        variant="contained"
        className={classes.submit}
        onClick={() => {
          const session = getSession(model)

          const trackId = [
            `${trackName.toLowerCase().replace(/ /g, '_')}-${Date.now()}`,
            `${session.adminMode ? '' : '-sessionTrack'}`,
          ].join('')

          // allow list of bigwigs in JSON format or line-by-line
          let bigWigs
          try {
            bigWigs = JSON.parse(val)
          } catch (e) {
            bigWigs = val.split('\n')
          }
          const obj =
            typeof bigWigs[0] === 'string'
              ? { bigWigs }
              : { subadapters: bigWigs }

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

          model.clearData()
          session.hideWidget(model)
        }}
      >
        Submit
      </Button>

      <p>Additional notes: </p>
      <ul>
        <li>
          The list of bigwig files in the text box can be a list of URLs, one
          per line or the JSON array, consisting of an array of filenames or a
          list of elements like{' '}
          <code>{`[{bigWigLocation:{uri:'http://host/file.bw'}, color:'green',source:'name for subtrack'}]`}</code>{' '}
          to apply e.g. the color attribute to the view
        </li>
        <li>
          Dragging the local files to the drop box it will update the textbox
          with contents that are ready to submit.
        </li>
      </ul>
    </Paper>
  )
}
