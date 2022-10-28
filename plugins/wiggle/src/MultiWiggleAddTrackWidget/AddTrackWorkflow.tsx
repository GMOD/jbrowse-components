import React, { useState } from 'react'
import { Button, Paper, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession, isElectron } from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { AddTrackModel } from '@jbrowse/plugin-data-management'

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
    display: 'block',
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
          Or, use the button below the text box to select files from your
          computer
        </li>
      </ul>

      <TextField
        multiline
        rows={10}
        value={val}
        onChange={event => setVal(event.target.value)}
        placeholder={'Paste list of URLs here, or use file selector below'}
        variant="outlined"
        className={classes.textbox}
      />

      <Button variant="outlined" component="label">
        Choose Files from your computer
        <input
          type="file"
          hidden
          multiple
          onChange={({ target }) => {
            const res = Array.from(target?.files || []).map(file => ({
              type: 'BigWigAdapter',
              bigWigLocation: isElectron
                ? {
                    localPath: (file as File & { path: string }).path,
                    locationType: 'LocalPathLocation',
                  }
                : storeBlobLocation({ blob: file }),
              source: file.name,
            }))
            setVal(JSON.stringify(res, null, 2))
          }}
        />
      </Button>
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
            bigWigs = val.split(/\n|\r\n|\r/)
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
}
