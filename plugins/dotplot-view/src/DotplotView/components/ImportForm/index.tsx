import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModeToggle,
  QuickStartPanel,
  allSessionTracks,
  dotplotAxesFromRows,
  getConnectedAssemblies,
  getSyntenyTracks,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import { Button, Container, Grid, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

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
  const tracks = allSessionTracks(session)
  const firstAssembly = assemblyNames[0] ?? ''
  const quick = useQuickStartState(tracks)
  const [assemblyX, setAssemblyX] = useState(firstAssembly)
  // the y-axis opens on an assembly the x-axis actually has synteny to, so
  // Manual starts on a plottable pair instead of a same-assembly one whose
  // picker is empty. Lazy because the scan walks every synteny track.
  const [assemblyY, setAssemblyY] = useState(
    () =>
      getConnectedAssemblies(tracks, firstAssembly)[0] ??
      assemblyNames[1] ??
      firstAssembly,
  )

  const quickAxes = dotplotAxesFromRows(quick.rows)
  const quickY = quickAxes.y ?? firstAssembly
  const quickX = quickAxes.x ?? firstAssembly

  const syntenyTracks = getSyntenyTracks(tracks, [assemblyX, assemblyY])

  // a dotplot is one pair, so the chosen Quick start track is the selection for
  // the form's single row
  function applyQuickSelection() {
    model.setImportFormSyntenyTrack(0, {
      type: 'preConfigured',
      value: quick.trackId,
    })
  }

  // the model owns the error: doSubmit clears it on the way in, so a re-submit
  // supersedes the old banner without a second copy of the state here
  const launch = (x: string, y: string) => {
    try {
      doSubmit({ model, session, assemblyX: x, assemblyY: y })
    } catch (e) {
      console.error(e)
      model.setError(e)
    }
  }

  return (
    <Container
      className={classes.importFormContainer}
      data-testid="import-form"
    >
      {model.error ? <ErrorBanner error={model.error} /> : null}

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
          <QuickStartPanel
            model={model}
            tracks={quick.quickTracks}
            trackId={quick.trackId}
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
            swapTitle="Put each assembly on the other axis (transposes the plot)"
          >
            {/* Only the track's first two assemblies are used, since a dotplot
            is one pair; an all-vs-all track's extras are called out rather than
            silently dropped. Which assembly lands on which axis is the user's
            choice, not a fact about the track (it answers in either direction),
            which is what Swap is for — see dotplotAxesFromRows. */}
            <div data-testid="quick-start-axes">
              <Typography variant="body2">X-axis: {quickX}</Typography>
              <Typography variant="body2">Y-axis: {quickY}</Typography>
              {quick.rows.length > 2 ? (
                <Typography variant="body2" color="text.secondary">
                  This track spans {quick.rows.length} assemblies; a dotplot
                  shows one pair, so the other {quick.rows.length - 2} are not
                  used. Switch to Manual to plot a different pair.
                </Typography>
              ) : null}
            </div>
          </QuickStartPanel>
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
