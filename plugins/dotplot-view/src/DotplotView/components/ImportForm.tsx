import React, { useState } from 'react'
import {
  Button,
  Container,
  FormControl,
  FormLabel,
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'

// locals
import { DotplotViewModel } from '../model'
import ImportCustomTrack from './ImportCustomTrack'
import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelector'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
  assemblySelector: {
    width: '75%',
    margin: '0 auto',
  },
}))

const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [assembly2, setAssembly2] = useState(
    assemblyNames.length ? assemblyNames[0] : '',
  )
  const [assembly1, setAssembly1] = useState(
    assemblyNames.length ? assemblyNames[0] : '',
  )
  const [error, setError] = useState<unknown>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessionTrackData, setSessionTrackData] = useState<any>()
  const [showTrackId, setShowTrackId] = useState<string>()
  const [choice, setChoice] = useState('none')

  function onOpenClick() {
    try {
      if (!isSessionWithAddTracks(session)) {
        return
      }
      setError(undefined)
      model.setError(undefined)
      transaction(() => {
        if (sessionTrackData) {
          session.addTrackConf(sessionTrackData)
          model.toggleTrack(sessionTrackData.trackId)
        } else if (showTrackId) {
          model.showTrack(showTrackId)
        }

        model.setViews([
          { bpPerPx: 0.1, offsetPx: 0 },
          { bpPerPx: 0.1, offsetPx: 0 },
        ])
        model.setAssemblyNames(assembly2, assembly1)
      })
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  // this is a combination of any displayed error message we have
  const displayError = error || model.error
  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorMessage error={displayError} /> : null}
      <Grid
        container
        spacing={1}
        justifyContent="center"
        alignItems="center"
        className={classes.assemblySelector}
      >
        <Grid item>
          <Paper style={{ padding: 12 }}>
            <p style={{ textAlign: 'center' }}>
              Select assemblies for dotplot view
            </p>
            <Grid
              container
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Grid item>
                <AssemblySelector
                  extra={0}
                  selected={assembly1}
                  onChange={val => setAssembly1(val)}
                  session={session}
                />
              </Grid>
              <Grid item>
                <AssemblySelector
                  extra={1}
                  selected={assembly2}
                  onChange={val => setAssembly2(val)}
                  session={session}
                />
              </Grid>
              <Grid item>
                <FormControl>
                  <Button
                    onClick={onOpenClick}
                    variant="contained"
                    color="primary"
                  >
                    Launch
                  </Button>
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
          <FormControl>
            <FormLabel id="group-label">
              (Optional) Select or add a synteny track
            </FormLabel>
            <RadioGroup
              row
              value={choice}
              onChange={event => setChoice(event.target.value)}
              aria-labelledby="group-label"
            >
              <FormControlLabel value="none" control={<Radio />} label="None" />
              <FormControlLabel
                value="tracklist"
                control={<Radio />}
                label="Select from tracklist"
              />
              <FormControlLabel
                value="custom"
                control={<Radio />}
                label="Open custom file"
              />
            </RadioGroup>
          </FormControl>
          {choice === 'custom' ? (
            <ImportCustomTrack
              setSessionTrackData={setSessionTrackData}
              sessionTrackData={sessionTrackData}
              assembly2={assembly2}
              assembly1={assembly1}
            />
          ) : null}
          {choice === 'tracklist' ? (
            <ImportSyntenyTrackSelector
              model={model}
              assembly1={assembly1}
              assembly2={assembly2}
              setShowTrackId={setShowTrackId}
            />
          ) : null}
        </Grid>
      </Grid>
    </Container>
  )
})

export default DotplotImportForm
