import React, { useState } from 'react'
import { Button, Container, FormControl, Grid, Paper } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { SnapshotIn } from 'mobx-state-tree'

// locals
import { LinearSyntenyViewModel } from '../../model'
import LinearSyntenyViewTrackSelector from './LinearSyntenyViewTrackSelector'

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

const LinearSyntenyViewImportForm = observer(function ({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [assembly2, setAssembly2] = useState(assemblyNames[0] || '')
  const [assembly1, setAssembly1] = useState(assemblyNames[0] || '')
  const [error, setError] = useState<unknown>()
  const [sessionTrackData, setSessionTrackData] = useState<Conf>()
  const [showTrackId, setShowTrackId] = useState<string>()

  async function onOpenClick() {
    try {
      if (!isSessionWithAddTracks(session)) {
        return
      }
      setError(undefined)

      const { assemblyManager } = session
      const assemblies = [assembly1, assembly2]
      model.setViews(
        await Promise.all(
          assemblies.map(async sel => {
            const asm = await assemblyManager.waitForAssembly(sel)
            if (!asm) {
              throw new Error(`Assembly ${sel} failed to load`)
            }
            return {
              type: 'LinearGenomeView' as const,
              bpPerPx: 1,
              offsetPx: 0,
              hideHeader: true,
              displayedRegions: asm.regions,
            }
          }),
        ),
      )
      model.views.forEach(view => view.setWidth(model.width))
      model.views.forEach(view => view.showAllRegions())
      if (sessionTrackData) {
        session.addTrackConf(sessionTrackData)
        model.toggleTrack(sessionTrackData.trackId)
      } else if (showTrackId) {
        model.showTrack(showTrackId)
      }
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  // this is a combination of any displayed error message we have
  const displayError = error
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
              Select assemblies for linear synteny view
            </p>
            <Grid
              container
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Grid item>
                <AssemblySelector
                  selected={assembly1}
                  onChange={val => setAssembly1(val)}
                  session={session}
                />
              </Grid>
              <Grid item>
                <AssemblySelector
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
          <LinearSyntenyViewTrackSelector
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

export default LinearSyntenyViewImportForm
