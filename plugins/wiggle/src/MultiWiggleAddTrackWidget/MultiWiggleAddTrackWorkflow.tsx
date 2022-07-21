import React, { useState } from 'react'
import { Button, Paper, Typography, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import { AddTrackModel } from '@jbrowse/plugin-data-management'

const useStyles = makeStyles()(theme => ({
  textbox: {
    width: '100%',
  },
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
  },
}))

export default function MultiWiggleWidget({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const [val, setVal] = useState('')
  return (
    <Paper className={classes.paper}>
      <Typography>
        Enter list of bigwig files, one per line or as a JSON array. The JSON
        array can be just an array of filenames or a list like{' '}
        <code>{`[{uri:'http://host/file.bw', color:'green',source:'name for subtrack'}]`}</code>{' '}
        to apply e.g. the color attribute to the view
      </Typography>
      <TextField
        helperText="Enter list of bigwig files"
        multiline
        rows={10}
        value={val}
        onChange={event => setVal(event.target.value)}
        variant="outlined"
        className={classes.textbox}
      />
      <Button
        variant="contained"
        onClick={() => {
          const session = getSession(model)
          const trackName = 'Hello'

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
          session.addTrackConf({
            trackId,
            type: 'MultiQuantitativeTrack',
            name: trackName,
            assemblyNames: [model.assembly],
            adapter: {
              type: 'MultiWiggleAdapter',
              bigWigs,
            },
          })
          model.view?.showTrack(trackId)

          model.clearData()
          session.hideWidget(model)
        }}
      >
        Submit
      </Button>
    </Paper>
  )
}
