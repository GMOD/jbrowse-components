import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ChromosomeFilter,
  ImportFormModes,
  allSessionTracks,
  applyQuickStartSelections,
  blockedByUnfinishedUpload,
  dotplotAxesFromRows,
  remapImportFormSelections,
  syntenyPairStatuses,
  useChromosomeFilters,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import {
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Paper,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelector from './TrackSelector.tsx'
import { doSubmit } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
  // left-aligned like the rest of the form and like the synteny import form.
  // Centering only these two fields put them alone in the middle of a wide
  // window, away from the toggle above and the radios below that govern them.
  //
  // ONE ROW PER AXIS, not all four controls on one line (review: "could
  // consider adding newline after this"). The row is the axis, so X's assembly
  // sits above Y's and the chromosome box that belongs to each is beside it —
  // flowed together they wrapped wherever the window width put them, and on a
  // wide window read as four unrelated fields.
  axis: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  axes: {
    marginBottom: theme.spacing(2),
  },
  // Launch below the track picker, not beside the axis selectors: picking a
  // track is the last thing configured, and a primary action above its own last
  // input reads as premature
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  header: {
    marginBottom: theme.spacing(1),
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
  const quick = useQuickStartState(session)
  const [assemblyX, setAssemblyX] = useState(firstAssembly)
  // Two different assemblies, so Manual doesn't open on a same-assembly pair
  // whose track picker is empty. There is no point consulting connectivity here:
  // any synteny track opens the form in Quick start instead, and reaching Manual
  // from there hands over that track's axes.
  const [assemblyY, setAssemblyY] = useState(assemblyNames[1] ?? firstAssembly)
  // row-indexed, and a dotplot's rows are its axes, x first — the order
  // doSubmit and `init.views` already use
  const chromosomes = useChromosomeFilters()

  // The one way the axes change, and the counterpart of LinearSyntenyView's
  // applyRows: re-match the track selection and the chromosome boxes to the pair
  // the axes now name.
  function applyAxes(nextX: string, nextY: string) {
    const from = [assemblyX, assemblyY]
    const to = [nextX, nextY]
    remapImportFormSelections(model, from, to)
    chromosomes.remap(from, to)
    setAssemblyX(nextX)
    setAssemblyY(nextY)
  }

  // the track's own row order plus the Swap flag, not `quick.rows`: Swap
  // transposes the pair on the axes rather than reversing the row list, which
  // for an all-vs-all track would have picked out a different pair entirely
  const quickAxes = dotplotAxesFromRows(quick.trackRows, quick.swapped)
  const quickY = quickAxes.y ?? firstAssembly
  const quickX = quickAxes.x ?? firstAssembly

  // the single-pair case of the check the synteny form runs per row pair: a
  // "New track" with no file yet resolves to no action, and launching on it
  // would open an empty dotplot with nothing saying why
  const canLaunch = !blockedByUnfinishedUpload(
    syntenyPairStatuses({
      tracks,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: [assemblyX, assemblyY],
      assemblyManager: session.assemblyManager,
    }),
  )

  // a dotplot is one pair however many assemblies the track names
  function applyQuickSelection() {
    applyQuickStartSelections(model, quick.trackId, 1)
  }

  // the model owns the error: doSubmit clears it on the way in, so a re-submit
  // supersedes the old banner without a second copy of the state here
  const launch = (
    x: string,
    y: string,
    rx = chromosomes.get(0),
    ry = chromosomes.get(1),
  ) => {
    try {
      doSubmit({
        model,
        session,
        assemblyX: x,
        assemblyY: y,
        regionsX: rx,
        regionsY: ry,
      })
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
        <ImportFormModes
          model={model}
          quick={quick}
          onHandoverToManual={() => {
            // the axes open on the chosen track instead of resetting
            setAssemblyX(quickX)
            setAssemblyY(quickY)
            // the handover brings the track's axes, so nothing typed against
            // whatever the Manual form was showing before still applies
            chromosomes.reset()
            applyQuickSelection()
          }}
          onQuickLaunch={() => {
            applyQuickSelection()
            // '' explicitly: Quick start does not show the chromosome boxes, so
            // it must not inherit text typed into the Manual ones behind it —
            // the pair it launches is the track's, not the one those boxes were
            // typed against.
            launch(quickX, quickY, '', '')
          }}
          swapTitle="Put each assembly on the other axis (transposes the plot)"
          quickSummary={
            /* Only the track's first two assemblies are used, since a dotplot
            is one pair; an all-vs-all track's extras are called out rather than
            silently dropped. Which assembly lands on which axis is the user's
            choice, not a fact about the track (it answers in either direction),
            which is what Swap is for — see dotplotAxesFromRows. */
            <div data-testid="quick-start-axes">
              <Typography variant="body2">X-axis: {quickX}</Typography>
              <Typography variant="body2">Y-axis: {quickY}</Typography>
              {quick.trackRows.length > 2 ? (
                <Typography variant="body2" color="text.secondary">
                  This track spans {quick.trackRows.length} assemblies; a
                  dotplot shows one pair, so the other{' '}
                  {quick.trackRows.length - 2} are not used. Switch to Manual to
                  plot a different pair.
                </Typography>
              ) : null}
            </div>
          }
        >
          <Typography className={classes.header}>
            Select assemblies for dotplot view
          </Typography>
          {/* off unless asked for — see useChromosomeFilters */}
          <FormControlLabel
            control={
              <Checkbox
                checked={chromosomes.shown}
                onChange={event => {
                  chromosomes.setShown(event.target.checked)
                }}
              />
            }
            label="Plot only certain chromosomes"
          />
          <div className={classes.axes}>
            <div className={classes.axis}>
              <AssemblySelector
                label="X-axis assembly"
                helperText=""
                selected={assemblyX}
                session={session}
                onChange={asm => {
                  applyAxes(asm, assemblyY)
                }}
              />
              {chromosomes.shown ? (
                <ChromosomeFilter
                  label="X-axis chromosomes"
                  testId="chromosome-filter-x"
                  value={chromosomes.get(0)}
                  onChange={value => {
                    chromosomes.set(0, value)
                  }}
                />
              ) : null}
            </div>
            <div className={classes.axis}>
              <AssemblySelector
                label="Y-axis assembly"
                helperText=""
                selected={assemblyY}
                session={session}
                onChange={asm => {
                  applyAxes(assemblyX, asm)
                }}
              />
              {chromosomes.shown ? (
                <ChromosomeFilter
                  label="Y-axis chromosomes"
                  testId="chromosome-filter-y"
                  value={chromosomes.get(1)}
                  onChange={value => {
                    chromosomes.set(1, value)
                  }}
                />
              ) : null}
            </div>
          </div>
          <TrackSelector
            key={`${assemblyX}-${assemblyY}`}
            model={model}
            assemblyX={assemblyX}
            assemblyY={assemblyY}
          />
          <div className={classes.footer}>
            <Button
              disabled={!canLaunch}
              onClick={() => {
                launch(assemblyX, assemblyY)
              }}
              variant="contained"
              color="primary"
            >
              Launch
            </Button>
            {canLaunch ? null : (
              <Typography variant="body2" color="warning.main">
                The new synteny track is unfinished. Choose a file, or set the
                track to None.
              </Typography>
            )}
          </div>
        </ImportFormModes>
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
