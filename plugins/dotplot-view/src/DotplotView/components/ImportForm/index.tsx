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
  syntenyPairStatuses,
  useImportFormRows,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Tooltip,
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
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

const AXIS_LABELS = ['X-axis', 'Y-axis']

const DotplotImportForm = observer(function DotplotImportForm({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const tracks = allSessionTracks(session)
  const firstAssembly = session.assemblyNames[0] ?? ''
  const quick = useQuickStartState(session)
  // the axes are the form's rows, x first — the order doSubmit and `init.views`
  // already use. Held here rather than in the panel, which the key below
  // remounts.
  const form = useImportFormRows(model, session.assemblyNames)
  const { rows, chromosomes, missingAssemblyRows } = form
  const assemblyX = rows[0]!
  const assemblyY = rows[1]!

  // the track's own row order plus the Swap flag, not `quick.rows`: Swap
  // transposes the pair on the axes rather than reversing the row list, which
  // for an all-vs-all track would have picked out a different pair entirely
  const quickAxes = dotplotAxesFromRows(quick.trackRows, quick.swapped)
  const quickY = quickAxes.y ?? firstAssembly
  const quickX = quickAxes.x ?? firstAssembly

  // the single-pair case of the check the synteny form runs per row pair: a
  // "New track" with no file yet resolves to no action, and launching on it
  // would open an empty dotplot with nothing saying why. A blank axis is the
  // other blocker: launched, it leaves the view on a spinner that never ends.
  const unfinishedUpload = blockedByUnfinishedUpload(
    syntenyPairStatuses({
      tracks,
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: rows,
      assemblyManager: session.assemblyManager,
    }),
  )
  const launchBlocker = missingAssemblyRows.length
    ? session.assemblyNames.length
      ? `The ${AXIS_LABELS[missingAssemblyRows[0]!]} assembly is not in this session.`
      : 'This session has no configured assemblies to plot.'
    : unfinishedUpload
      ? 'The new synteny track is unfinished. Choose a file, or set the track to None.'
      : undefined

  // the two axes are the dotplot's rows, so this is the one-pair case however
  // many assemblies the track names
  function applyQuickSelection() {
    applyQuickStartSelections(model, quick.trackId, [quickX, quickY])
  }

  // the model owns the error: doSubmit clears it on the way in, so a re-submit
  // supersedes the old banner without a second copy of the state here
  const launch = (
    x: string,
    y: string,
    regions = [chromosomes.get(0), chromosomes.get(1)],
  ) => {
    try {
      doSubmit({
        model,
        session,
        assemblyX: x,
        assemblyY: y,
        regionsX: regions[0],
        regionsY: regions[1],
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
      <ImportFormModes
        model={model}
        quick={quick}
        onHandoverToManual={() => {
          // the axes open on the chosen track instead of resetting
          form.reset([quickX, quickY])
          applyQuickSelection()
        }}
        onQuickLaunch={() => {
          applyQuickSelection()
          // '' explicitly: Quick start does not show the chromosome boxes, so
          // it must not inherit text typed into the Manual ones behind it —
          // the pair it launches is the track's, not the one those boxes were
          // typed against.
          launch(quickX, quickY, ['', ''])
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
                This track spans {quick.trackRows.length} assemblies; a dotplot
                shows one pair, so the other {quick.trackRows.length - 2} are
                not used. Switch to Manual to plot a different pair.
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
          {rows.map((assemblyName, idx) => (
            <div className={classes.axis} key={AXIS_LABELS[idx]}>
              <AssemblySelector
                label={`${AXIS_LABELS[idx]} assembly`}
                helperText=""
                selected={assemblyName}
                session={session}
                onChange={asm => {
                  form.applyRows(
                    rows.map((row, i) => (i === idx ? asm : row)),
                    0,
                  )
                }}
              />
              {chromosomes.shown ? (
                <ChromosomeFilter
                  label={`${AXIS_LABELS[idx]} chromosomes`}
                  testId={`chromosome-filter-${idx === 0 ? 'x' : 'y'}`}
                  value={chromosomes.get(idx)}
                  onChange={value => {
                    chromosomes.set(idx, value)
                  }}
                />
              ) : null}
            </div>
          ))}
          {/* Manual's counterpart to Quick start's Swap. Doing it through the
          two Selects passes through a same-assembly pair, and the track
          selection does not survive that: it is about the pair {x, y}, which
          the intermediate {y, y} is not, so a deliberate None or a specific
          pick among several tracks was gone by the time the pair came back. */}
          <Tooltip title="Swap the axes (transposes the plot)">
            <Button
              variant="outlined"
              size="small"
              startIcon={<SwapVertIcon />}
              onClick={() => {
                form.applyRows([assemblyY, assemblyX], 0)
              }}
            >
              Swap axes
            </Button>
          </Tooltip>
        </div>
        <TrackSelector
          key={`${assemblyX}-${assemblyY}`}
          model={model}
          assemblyX={assemblyX}
          assemblyY={assemblyY}
          choices={form.choices}
        />
        <div className={classes.footer}>
          <Button
            disabled={launchBlocker !== undefined}
            onClick={() => {
              launch(assemblyX, assemblyY)
            }}
            variant="contained"
            color="primary"
          >
            Launch
          </Button>
          {launchBlocker ? (
            <Typography variant="body2" color="warning.main">
              {launchBlocker}
            </Typography>
          ) : null}
        </div>
      </ImportFormModes>
    </Container>
  )
})

export default DotplotImportForm
