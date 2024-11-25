import React, { useState, useEffect } from 'react'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
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
  Typography,
} from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import ImportCustomTrack from './ImportCustomTrack'
import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelector'
import type { DotplotViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from 'mobx-state-tree'

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

type Conf = SnapshotIn<AnyConfigurationModel>

function TrackSelector({
  setSessionTrackData,
  setShowTrackId,
  sessionTrackData,
  assembly1,
  assembly2,
  model,
}: {
  sessionTrackData: Conf
  setSessionTrackData: (arg: Conf) => void
  setShowTrackId: (arg?: string) => void
  model: DotplotViewModel
  assembly1: string
  assembly2: string
}) {
  const [choice, setChoice] = useState('tracklist')

  useEffect(() => {
    if (choice === 'none') {
      setSessionTrackData(undefined)
      setShowTrackId(undefined)
    }
  }, [choice, setSessionTrackData, setShowTrackId])
  return (
    <>
      <FormControl>
        <FormLabel id="group-label">
          (Optional) Select or add a synteny track
        </FormLabel>
        <RadioGroup
          row
          value={choice}
          onChange={event => {
            setChoice(event.target.value)
          }}
          aria-labelledby="group-label"
        >
          <FormControlLabel value="none" control={<Radio />} label="None" />
          <FormControlLabel
            value="tracklist"
            control={<Radio />}
            label="Existing track"
          />
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="New track"
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
    </>
  )
}

const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [assembly2, setAssembly2] = useState(assemblyNames[0] || '')
  const [assembly1, setAssembly1] = useState(assemblyNames[0] || '')
  const [error, setError] = useState<unknown>()
  const [sessionTrackData, setSessionTrackData] = useState<Conf>()
  const [showTrackId, setShowTrackId] = useState<string>()

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
            <Typography style={{ textAlign: 'center' }}>
              Select assemblies for dotplot view
            </Typography>
            <Grid
              container
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Grid item>
                <AssemblySelector
                  selected={assembly1}
                  onChange={val => {
                    setAssembly1(val)
                  }}
                  session={session}
                />
              </Grid>
              <Grid item>
                <AssemblySelector
                  selected={assembly2}
                  onChange={val => {
                    setAssembly2(val)
                  }}
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
          <TrackSelector
            setShowTrackId={setShowTrackId}
            assembly2={assembly2}
            assembly1={assembly1}
            setSessionTrackData={setSessionTrackData}
            sessionTrackData={sessionTrackData}
            model={model}
          />
        </Grid>
      </Grid>
    </Container>
  )
})

export default DotplotImportForm
