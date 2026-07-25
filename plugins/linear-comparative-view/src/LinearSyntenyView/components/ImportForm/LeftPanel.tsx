import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  getConnectedAssemblies,
  getSyntenyTracks,
  planSyntenyChain,
  resolveRowTrackAction,
} from '@jbrowse/synteny-core'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { assemblyPairAt, planRowRemoval } from '../../util/importFormRows.ts'

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

// Whether each row pair still needs the user's attention before launch: it does
// unless launching would actually apply a track. An explicit "none" is a
// deliberate no-track and so never needs attention; every other case defers to
// the same resolveRowTrackAction call doSubmit makes, so the warning icon and
// what launch really does can't drift apart. That covers a pending or stranded
// upload (a userOpened whose baked assemblies no longer match the pair) and a
// pair with no pre-configured track to auto-pick.
function rowsNeedingConfiguration(
  model: LinearSyntenyViewModel,
  session: AbstractSessionModel,
  selectedAssemblyNames: string[],
) {
  return selectedAssemblyNames.slice(0, -1).map((_, idx) => {
    const pairAssemblies = assemblyPairAt(selectedAssemblyNames, idx)
    const selection = model.importFormSyntenyTrackSelections[idx]
    return (
      selection?.type !== 'none' &&
      !resolveRowTrackAction(
        selection,
        getSyntenyTracks(session.tracks, pairAssemblies),
        pairAssemblies,
      )
    )
  })
}

const AssemblyRows = observer(function AssemblyRows({
  selectedRow,
  selectedAssemblyNames,
  needsConfigByPair,
  setSelectedRow,
  setSelectedAssemblyNames,
  model,
}: {
  selectedRow: number
  selectedAssemblyNames: string[]
  needsConfigByPair: boolean[]
  setSelectedRow: (idx: number) => void
  setSelectedAssemblyNames: (assemblies: string[]) => void
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  function removeRow(idx: number) {
    const { removedPair, nextSelectedPair } = planRowRemoval({
      rowCount: selectedAssemblyNames.length,
      removedRow: idx,
      selectedPair: selectedRow,
    })
    model.importFormRemoveRow(removedPair)
    setSelectedAssemblyNames(selectedAssemblyNames.filter((_, i) => i !== idx))
    setSelectedRow(nextSelectedPair)
  }
  return selectedAssemblyNames.map((assemblyName, idx) => {
    const isPairRow = idx !== selectedAssemblyNames.length - 1
    const needsConfig = needsConfigByPair[idx] === true
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
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  selectedRow: number
  setSelectedRow: (row: number) => void
  defaultAssemblyName: string
  onLaunch: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  // computed once for the whole panel: the per-row warning icons and the Launch
  // button are two views of the same answer, and each entry costs a scan of the
  // session's tracks
  const needsConfigByPair = rowsNeedingConfiguration(
    model,
    session,
    selectedAssemblyNames,
  )
  const canLaunch = needsConfigByPair.every(needsConfig => !needsConfig)

  return (
    <>
      <div className={classes.mb}>
        Select assemblies for linear synteny view
      </div>
      <div data-testid="synteny-assembly-rows">
        <AssemblyRows
          model={model}
          selectedAssemblyNames={selectedAssemblyNames}
          needsConfigByPair={needsConfigByPair}
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
              disabled={!canLaunch}
              onClick={() => {
                onLaunch()
              }}
              variant="contained"
              color="primary"
            >
              Launch
            </Button>
          </span>
        </Tooltip>
      </div>
    </>
  )
})

export default LeftPanel
