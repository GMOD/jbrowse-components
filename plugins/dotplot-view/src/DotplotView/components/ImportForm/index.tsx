import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModeToggle,
  getSyntenyTracks,
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from '@jbrowse/synteny-core'
import { Button, Container, Grid, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import QuickStart from './QuickStart.tsx'
import TrackSelector from './TrackSelector.tsx'
import { doSubmit } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'
import type { ImportFormMode } from '@jbrowse/synteny-core'

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
  const quickTracks = quickStartSyntenyTracks(session.tracks)
  const [mode, setMode] = useState<ImportFormMode>(
    quickTracks.length ? 'quick' : 'manual',
  )
  const [quickTrackId, setQuickTrackId] = useState(quickTracks[0]?.trackId ?? '')
  const [assemblyX, setAssemblyX] = useState(firstAssembly)
  const [assemblyY, setAssemblyY] = useState(firstAssembly)
  const [error, setError] = useState<unknown>()

  const quickTrack = quickTracks.find(t => t.trackId === quickTrackId)
  const quickRows = quickTrack ? syntenyTrackRows(quickTrack) : []
  // the extension-point/core convention is assembly1 = Y, assembly2 = X
  const quickY = quickRows[0] ?? firstAssembly
  const quickX = quickRows[1] ?? firstAssembly

  const syntenyTracks = getSyntenyTracks(session.tracks, [assemblyX, assemblyY])
  const displayError = error ?? model.error

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
    <Container className={classes.importFormContainer} data-testid="import-form">
      {displayError ? <ErrorBanner error={displayError} /> : null}

      <Paper style={{ padding: 12 }}>
        <div className={classes.toggle}>
          <ImportFormModeToggle
            mode={mode}
            onChange={newMode => {
              // switching to Manual hands over what Quick start had set up, so
              // the axes open on the chosen track instead of resetting
              if (newMode === 'manual' && quickTrack) {
                setAssemblyX(quickX)
                setAssemblyY(quickY)
                model.setImportFormSyntenyTrack(0, {
                  type: 'preConfigured',
                  value: quickTrackId,
                })
              }
              setMode(newMode)
            }}
          />
        </div>
        {mode === 'quick' ? (
          <QuickStart
            model={model}
            tracks={quickTracks}
            trackId={quickTrackId}
            rows={quickRows}
            submitting={false}
            onChange={setQuickTrackId}
            onLaunch={() => {
              model.setImportFormSyntenyTrack(0, {
                type: 'preConfigured',
                value: quickTrackId,
              })
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
