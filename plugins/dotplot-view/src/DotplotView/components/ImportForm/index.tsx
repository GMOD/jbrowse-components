import { useState } from 'react'

import { AssemblySelector, ErrorMessage } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  Button,
  Container,
  FormControl,
  Grid2,
  Paper,
  Typography,
} from '@mui/material'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { DotplotViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from 'mobx-state-tree'
import TrackSelector from './TrackSelector'

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

const DotplotImportForm = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
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

        model.showAllRegions()
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

      <Paper style={{ padding: 12 }}>
        <Typography style={{ textAlign: 'center' }}>
          Select assemblies for dotplot view
        </Typography>
        <Grid2
          container
          spacing={1}
          justifyContent="center"
          alignItems="center"
        >
          <AssemblySelector
            helperText="x-axis assembly"
            selected={assembly2}
            session={session}
            onChange={val => {
              setAssembly2(val)
            }}
          />
          <AssemblySelector
            helperText="y-axis assembly"
            selected={assembly1}
            session={session}
            onChange={val => {
              setAssembly1(val)
            }}
          />
          <FormControl>
            <Button onClick={onOpenClick} variant="contained" color="primary">
              Launch
            </Button>
          </FormControl>
        </Grid2>
        <TrackSelector
          setShowTrackId={setShowTrackId}
          assembly2={assembly2}
          assembly1={assembly1}
          setSessionTrackData={setSessionTrackData}
          model={model}
        />
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
