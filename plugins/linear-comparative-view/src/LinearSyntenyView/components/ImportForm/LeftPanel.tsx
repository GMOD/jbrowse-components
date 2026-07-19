import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  getConnectedAssemblies,
  getSyntenyTracks,
  pickSyntenyTrackId,
  planSyntenyChain,
  sameAssemblySet,
} from '@jbrowse/synteny-core'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Button, CircularProgress, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  mb: {
    marginBottom: 10,
  },
  button: {
    margin: theme.spacing(2),
  },
  rel: {
    position: 'relative',
  },
  synbutton: {
    position: 'absolute',
    top: 30,
  },
  synbuttonNeedsConfig: {
    color: theme.palette.warning.main,
  },
  bg: {
    background: theme.palette.divider,
  },
}))

// Whether the row pair still needs the user's attention before launch.
// - explicit "none": deliberately no track, fine.
// - "New track" (userOpened): fine only once a file is chosen and its baked
//   assemblies still match the pair; a pending or stranded upload is flagged.
// - untouched / preConfigured: fine as long as a synteny track exists for the
//   pair, since doSubmit auto-picks (the pick if still valid, else the first).
function rowNeedsConfiguration(
  model: LinearSyntenyViewModel,
  session: AbstractSessionModel,
  selectedAssemblyNames: string[],
  idx: number,
) {
  const pairAssemblies = [
    selectedAssemblyNames[idx]!,
    selectedAssemblyNames[idx + 1]!,
  ]
  const selection = model.importFormSyntenyTrackSelections[idx]
  if (selection?.type === 'userOpened') {
    return (
      !selection.value ||
      !sameAssemblySet(selection.value.assemblyNames, pairAssemblies)
    )
  }
  if (selection?.type === 'none') {
    return false
  }
  const picked = selection?.type === 'preConfigured' ? selection.value : ''
  return !pickSyntenyTrackId(picked, getSyntenyTracks(session.tracks, pairAssemblies))
}

const AssemblyRows = observer(function AssemblyRows({
  selectedRow,
  selectedAssemblyNames,
  setSelectedRow,
  setSelectedAssemblyNames,
  model,
}: {
  selectedRow: number
  selectedAssemblyNames: string[]
  setSelectedRow: (idx: number) => void
  setSelectedAssemblyNames: (assemblies: string[]) => void
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  function removeRow(idx: number) {
    const rowCount = selectedAssemblyNames.length
    // the pair-selection that disappears is the pair below this row, except for
    // the last row, whose only pair is the one above it
    model.importFormRemoveRow(Math.min(idx, rowCount - 2))
    setSelectedAssemblyNames(selectedAssemblyNames.filter((_, i) => i !== idx))
    // keep the arrow on the same pair — a removal above it shifts its index
    // down — then clamp into the new pair range [0, rowCount - 3]
    const shifted = idx < selectedRow ? selectedRow - 1 : selectedRow
    setSelectedRow(Math.min(shifted, rowCount - 3))
  }
  return selectedAssemblyNames.map((assemblyName, idx) => {
    const isPairRow = idx !== selectedAssemblyNames.length - 1
    const needsConfig =
      isPairRow &&
      rowNeedsConfiguration(model, session, selectedAssemblyNames, idx)
    // a self-alignment pair is valid, but only if a synteny track references the
    // assembly against itself; call it out so an unsatisfied same-assembly pair
    // doesn't read like the generic "pick a track" warning
    const sameAssembly =
      isPairRow && assemblyName === selectedAssemblyNames[idx + 1]
    const needsConfigTitle =
      needsConfig && sameAssembly
        ? `Rows ${idx + 1} and ${idx + 2} both use ${assemblyName} — add a self-alignment synteny track or pick a different assembly`
        : `Synteny track not configured between row ${idx + 1} and ${idx + 2} — click to configure`
    return (
      // eslint-disable-next-line @eslint-react/no-array-index-key -- row position is the identity here; assembly names can repeat across rows
      <div key={`${assemblyName}-${idx}`} className={classes.rel}>
        <AssemblySelector
          label={`Row ${idx + 1} assembly`}
          helperText=""
          selected={assemblyName}
          onChange={newAssembly => {
            setSelectedAssemblyNames(
              selectedAssemblyNames.map((asm, idx2) =>
                idx2 === idx ? newAssembly : asm,
              ),
            )
          }}
          session={session}
        />
        <Tooltip
          title={
            selectedAssemblyNames.length <= 2
              ? 'Synteny view requires at least 2 rows'
              : 'Remove this row'
          }
        >
          <span>
            <IconButton
              aria-label={`Remove row ${idx + 1}`}
              disabled={selectedAssemblyNames.length <= 2}
              onClick={() => {
                removeRow(idx)
              }}
            >
              <CloseIcon />
            </IconButton>
          </span>
        </Tooltip>
        {isPairRow ? (
          <Tooltip
            title={
              needsConfig
                ? needsConfigTitle
                : `Configure synteny track between row ${idx + 1} and ${idx + 2}`
            }
          >
            <IconButton
              data-testid="synbutton"
              aria-label={`Configure synteny track between row ${idx + 1} and ${idx + 2}`}
              className={cx(
                classes.synbutton,
                idx === selectedRow ? classes.bg : undefined,
                needsConfig ? classes.synbuttonNeedsConfig : undefined,
              )}
              onClick={() => {
                setSelectedRow(idx)
              }}
            >
              {needsConfig ? <WarningAmberIcon /> : <ArrowForwardIosIcon />}
            </IconButton>
          </Tooltip>
        ) : null}
      </div>
    )
  })
})

const LeftPanel = observer(function LeftPanel({
  model,
  selectedAssemblyNames,
  setSelectedAssemblyNames,
  selectedRow,
  setSelectedRow,
  defaultAssemblyName,
  submitting,
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  selectedRow: number
  setSelectedRow: (row: number) => void
  defaultAssemblyName: string
  submitting: boolean
  onLaunch: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const canLaunch = selectedAssemblyNames
    .slice(0, -1)
    .every(
      (_, i) =>
        !rowNeedsConfiguration(model, session, selectedAssemblyNames, i),
    )

  return (
    <>
      <div className={classes.mb}>
        Select assemblies for linear synteny view
      </div>
      <div data-testid="synteny-assembly-rows">
        <AssemblyRows
          model={model}
          selectedAssemblyNames={selectedAssemblyNames}
          setSelectedAssemblyNames={setSelectedAssemblyNames}
          selectedRow={selectedRow}
          setSelectedRow={setSelectedRow}
        />
      </div>

      <div>
        <Button
          className={classes.button}
          variant="outlined"
          onClick={() => {
            // default the new row to an assembly that already has a synteny
            // track to the current bottom row, so the added pair is launchable
            // instead of immediately flagged as needing configuration
            const bottom =
              selectedAssemblyNames[selectedAssemblyNames.length - 1]!
            const connected = getConnectedAssemblies(session.tracks, bottom)
            setSelectedAssemblyNames([
              ...selectedAssemblyNames,
              connected[0] ?? defaultAssemblyName,
            ])
          }}
        >
          Add row
        </Button>
        {selectedAssemblyNames.length > 2 && !canLaunch ? (
          <Tooltip title="Reorder rows so adjacent pairs share a synteny dataset">
            <Button
              className={classes.button}
              variant="outlined"
              onClick={() => {
                setSelectedAssemblyNames(
                  planSyntenyChain(
                    selectedAssemblyNames,
                    (a, b) =>
                      a !== b &&
                      getSyntenyTracks(session.tracks, [a, b]).length > 0,
                  ),
                )
                // per-pair selections are indexed by row position, so a
                // reorder invalidates them; clear so doSubmit auto-picks each
                // pair's track for the new ordering
                setSelectedRow(0)
                model.clearImportFormSyntenyTracks()
              }}
            >
              Auto-arrange rows
            </Button>
          </Tooltip>
        ) : null}
        <Tooltip
          title={
            canLaunch
              ? ''
              : 'Configure a synteny track for each highlighted row pair before launching'
          }
        >
          <span>
            <Button
              className={classes.button}
              disabled={!canLaunch || submitting}
              startIcon={
                submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : undefined
              }
              onClick={() => {
                onLaunch()
              }}
              variant="contained"
              color="primary"
            >
              {submitting ? 'Launching…' : 'Launch'}
            </Button>
          </span>
        </Tooltip>
      </div>
    </>
  )
})

export default LeftPanel
