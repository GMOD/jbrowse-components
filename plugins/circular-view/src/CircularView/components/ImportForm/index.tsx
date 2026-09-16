import { useState } from 'react'

import {
  AssemblySelector,
  ErrorBanner,
  useAssemblySelection,
} from '@jbrowse/core/ui'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ChromosomeFilter,
  ImportFormModes,
  ImportFormSyntenyTrackPanel,
  allSessionTracks,
  applyQuickStartSelections,
  blockedByUnfinishedUpload,
  getConnectedAssemblies,
  syntenyPairStatuses,
  useImportFormRows,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import CloseIcon from '@mui/icons-material/Close'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import {
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { doSubmit } from './doSubmit.ts'

import type { CircularViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
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

const ROW_LABELS = ['Assembly', 'Second assembly']

function circleSummary(rows: string[]) {
  const [first, second] = rows
  return first === second
    ? `${first}, aligned to itself`
    : `${first}, then ${second} mirrored after it`
}

const CircularImportForm = observer(function CircularImportForm({
  model,
}: {
  model: CircularViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const tracks = allSessionTracks(session)
  const remembered = useAssemblySelection(session, 'circular')
  const quick = useQuickStartState(session)
  const form = useImportFormRows(
    model,
    remembered.selectedAssemblyName
      ? [
          remembered.selectedAssemblyName,
          ...assemblyNames.filter(n => n !== remembered.selectedAssemblyName),
        ]
      : assemblyNames,
    1,
  )
  const { rows, chromosomes, missingAssemblyRows } = form
  const [reorder, setReorder] = useState(true)

  const [trackFirst, trackSecond] = quick.trackRows
  const quickRows =
    trackFirst === undefined || trackSecond === undefined
      ? []
      : quick.swapped
        ? [trackSecond, trackFirst]
        : [trackFirst, trackSecond]

  const paired = rows.length === 2
  const unfinishedUpload =
    paired &&
    blockedByUnfinishedUpload(
      syntenyPairStatuses({
        tracks,
        selections: model.importFormSyntenyTrackSelections,
        assemblyNames: rows,
        assemblyManager,
      }),
    )
  const launchBlocker = missingAssemblyRows.length
    ? assemblyNames.length
      ? `The ${ROW_LABELS[missingAssemblyRows[0]!]!.toLowerCase()} is not in this session.`
      : 'This session has no configured assemblies to open.'
    : unfinishedUpload
      ? 'The new synteny track is unfinished. Choose a file, or set the track to None.'
      : undefined

  const launch = (
    launchRows: string[],
    regionNames: string[],
    autoDiagonalize: boolean,
  ) => {
    try {
      doSubmit({
        model,
        session,
        rows: launchRows,
        regionNames,
        autoDiagonalize,
      })
    } catch (e) {
      console.error(e)
      model.setError(e)
    }
  }

  function addSecondAssembly() {
    const first = rows[0]!
    const second =
      [
        ...getConnectedAssemblies(tracks, first, assemblyManager),
        ...assemblyNames,
      ].find(name => name !== first) ?? first
    form.applyRows([first, second], 0)
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
          form.reset(quickRows)
          applyQuickStartSelections(model, quick.trackId, quickRows)
        }}
        onQuickLaunch={() => {
          applyQuickStartSelections(model, quick.trackId, quickRows)
          launch(quickRows, [], true)
        }}
        swapTitle="Swap which genome starts the circle"
        quickSummary={
          <div data-testid="quick-start-circle">
            <Typography variant="body2">
              Opens a circle of {circleSummary(quickRows)}
            </Typography>
            {quick.trackRows.length > 2 ? (
              <Typography variant="body2" color="text.secondary">
                This track spans {quick.trackRows.length} assemblies; the circle
                shows the first two. Switch to Manual to pick a different pair.
              </Typography>
            ) : null}
          </div>
        }
      >
        <Typography className={classes.header}>
          Select assemblies for the circular view
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={chromosomes.shown}
              onChange={event => {
                chromosomes.setShown(event.target.checked)
              }}
            />
          }
          label="Show only certain chromosomes"
        />
        <div className={classes.rows}>
          {rows.map((assemblyName, idx) => (
            <div className={classes.row} key={ROW_LABELS[idx]}>
              <AssemblySelector
                label={ROW_LABELS[idx]}
                helperText=""
                selected={assemblyName}
                session={session}
                onChange={asm => {
                  model.setError(undefined)
                  if (idx === 0) {
                    remembered.setSelectedAssemblyName(asm)
                  }
                  form.applyRows(
                    rows.map((row, i) => (i === idx ? asm : row)),
                    0,
                  )
                }}
              />
              {chromosomes.shown ? (
                <ChromosomeFilter
                  label={`${ROW_LABELS[idx]} chromosomes`}
                  testId={`chromosome-filter-${idx}`}
                  value={chromosomes.get(idx)}
                  onChange={value => {
                    chromosomes.set(idx, value)
                  }}
                />
              ) : null}
              {idx === 1 ? (
                <IconButton
                  aria-label="Remove the second assembly"
                  onClick={() => {
                    form.applyRows([rows[0]!], 0)
                  }}
                >
                  <CloseIcon />
                </IconButton>
              ) : null}
            </div>
          ))}
          {paired ? (
            <Tooltip describeChild title="Swap which genome starts the circle">
              <Button
                variant="outlined"
                size="small"
                startIcon={<SwapVertIcon />}
                onClick={() => {
                  form.applyRows([rows[1]!, rows[0]!], 0)
                }}
              >
                Swap assemblies
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              describeChild
              title="Draw a second genome on the circle, with a synteny track's ribbons between the two"
            >
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  addSecondAssembly()
                }}
              >
                Add a second assembly
              </Button>
            </Tooltip>
          )}
        </div>
        {paired ? (
          <>
            <ImportFormSyntenyTrackPanel
              key={`${rows[0]}-${rows[1]}`}
              model={model}
              rowIndex={0}
              assembly1={rows[0]!}
              assembly2={rows[1]!}
              choices={form.choices}
              label="(Optional) Select or add a synteny track"
              emptyRemedy='Choose "New track" above to add one, or launch anyway to draw both genomes with no ribbons between them.'
            >
              <Typography variant="body2" color="text.secondary">
                More tracks can be turned on from the track selector{' '}
                <TrackSelectorIcon /> once the circle is open.
              </Typography>
            </ImportFormSyntenyTrackPanel>
            {rows[0] === rows[1] ? null : (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={reorder}
                    onChange={event => {
                      setReorder(event.target.checked)
                    }}
                  />
                }
                label="Reorder the second genome's chromosomes to follow the first"
              />
            )}
          </>
        ) : null}
        <div className={classes.footer}>
          <Button
            disabled={launchBlocker !== undefined}
            onClick={() => {
              launch(rows, chromosomes.values, reorder)
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

export default CircularImportForm
