import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModeToggle,
  dotplotAxesFromRows,
  getSyntenyTracks,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import { Button, Container, Grid, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import QuickStart from './QuickStart.tsx'
import TrackSelector from './TrackSelector.tsx'
import { doSubmit } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
  toggle: {
    marginBottom: theme.spacing(2),
  },
}))

const DotplotImportForm = observer(function DotplotImportForm({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const firstAssembly = assemblyNames[0] ?? ''
  const quick = useQuickStartState(session.tracks)
  const [assemblyX, setAssemblyX] = useState(firstAssembly)
  const [assemblyY, setAssemblyY] = useState(firstAssembly)
  const [error, setError] = useState<unknown>()

  const quickAxes = dotplotAxesFromRows(quick.rows)
  const quickY = quickAxes.y ?? firstAssembly
  const quickX = quickAxes.x ?? firstAssembly

  const syntenyTracks = getSyntenyTracks(session.tracks, [assemblyX, assemblyY])
  const displayError = error ?? model.error

  // a dotplot is one pair, so the chosen Quick start track is the selection for
  // the form's single row
  function applyQuickSelection() {
    model.setImportFormSyntenyTrack(0, {
      type: 'preConfigured',
      value: quick.trackId,
    })
  }

  const launch = (x: string, y: string) => {
    try {
      setError(undefined)
      doSubmit({
        model,
        session,
        assemblyX: x,
        assemblyY: y,
      })
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  return (
    <Container
      className={classes.importFormContainer}
      data-testid="import-form"
    >
      {displayError ? <ErrorBanner error={displayError} /> : null}

      <Paper style={{ padding: 12 }}>
        <div className={classes.toggle}>
          <ImportFormModeToggle
            mode={quick.mode}
            onChange={newMode => {
              // switching to Manual hands over what Quick start had set up, so
              // the axes open on the chosen track instead of resetting
              if (newMode === 'manual' && quick.track) {
                setAssemblyX(quickX)
                setAssemblyY(quickY)
                applyQuickSelection()
              }
              quick.setMode(newMode)
            }}
          />
        </div>
        {quick.mode === 'quick' ? (
          <QuickStart
            model={model}
            tracks={quick.quickTracks}
            trackId={quick.trackId}
            rows={quick.rows}
            onChange={newTrackId => {
              quick.setTrackId(newTrackId)
            }}
            onSwap={() => {
              quick.swap()
            }}
            onLaunch={() => {
              applyQuickSelection()
              launch(quickX, quickY)
            }}
          />
        ) : (
          <>
            <Typography style={{ textAlign: 'center' }}>
              Select assemblies for dotplot view
            </Typography>
            <Grid
              container
              spacing={1}
              sx={{ justifyContent: 'center', alignItems: 'center' }}
            >
              <AssemblySelector
                label="X-axis assembly"
                helperText=""
                selected={assemblyX}
                session={session}
                onChange={asm => {
                  setAssemblyX(asm)
                }}
              />
              <AssemblySelector
                label="Y-axis assembly"
                helperText=""
                selected={assemblyY}
                session={session}
                onChange={asm => {
                  setAssemblyY(asm)
                }}
              />
              <Button
                onClick={() => {
                  launch(assemblyX, assemblyY)
                }}
                variant="contained"
                color="primary"
              >
                Launch
              </Button>
            </Grid>
            <TrackSelector
              key={`${assemblyX}-${assemblyY}`}
              model={model}
              assemblyX={assemblyX}
              assemblyY={assemblyY}
              syntenyTracks={syntenyTracks}
            />
          </>
        )}
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
