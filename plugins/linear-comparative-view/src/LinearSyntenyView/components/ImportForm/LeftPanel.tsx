import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  allSessionTracks,
  getConnectedAssemblies,
  getSyntenyTracks,
  planSyntenyChain,
  remapUploadsToPairs,
  resolveSyntenyTrackActions,
} from '@jbrowse/synteny-core'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { planRowRemoval } from '../../util/importFormRows.ts'

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
  synbuttonUnfinished: {
    color: theme.palette.warning.main,
  },
  bg: {
    background: theme.palette.divider,
  },
}))

/**
 * What launching would do to each row pair. Launch's own answer is the only
 * input, so the row icons and what launch really does can't drift apart.
 *
 * - `configured`: a track will be applied.
 * - `unfinishedUpload`: the user started a "New track" upload that cannot be
 *   applied — no file chosen yet, or its baked assemblies no longer match this
 *   pair. The only state that blocks Launch, because it is unfinished input
 *   rather than an absence, and launching would quietly drop it.
 * - `noTrackAvailable`: nothing connects these two rows. Perfectly launchable —
 *   the rows stack with no ribbons between them — but a reorder might fix it, so
 *   it is what offers Auto-arrange.
 * - `deliberateNone`: the user chose None. Same result as `noTrackAvailable`, but
 *   asked for, so it does not go looking for a better row order.
 */
type PairStatus =
  | 'configured'
  | 'unfinishedUpload'
  | 'noTrackAvailable'
  | 'deliberateNone'

function pairStatuses(
  model: LinearSyntenyViewModel,
  session: AbstractSessionModel,
  selectedAssemblyNames: string[],
): PairStatus[] {
  const selections = model.importFormSyntenyTrackSelections
  return resolveSyntenyTrackActions({
    tracks: allSessionTracks(session),
    selections,
    assemblyNames: selectedAssemblyNames,
  }).map((action, idx) =>
    action
      ? 'configured'
      : selections[idx]?.type === 'userOpened'
        ? 'unfinishedUpload'
        : selections[idx]?.type === 'none'
          ? 'deliberateNone'
          : 'noTrackAvailable',
  )
}

const AssemblyRows = observer(function AssemblyRows({
  selectedRow,
  selectedAssemblyNames,
  statusByPair,
  setSelectedRow,
  setSelectedAssemblyNames,
  model,
}: {
  selectedRow: number
  selectedAssemblyNames: string[]
  statusByPair: PairStatus[]
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
    const status = statusByPair[idx]
    const rows = `row ${idx + 1} and ${idx + 2}`
    // a same-assembly pair is legal, but only a track naming the assembly twice
    // can connect it, so say that rather than sending the user looking for a
    // cross-species dataset
    const sameAssembly =
      isPairRow && assemblyName === selectedAssemblyNames[idx + 1]
    const title =
      status === 'unfinishedUpload'
        ? `Finish the new synteny track for ${rows}, or pick another option — click to configure`
        : status === 'deliberateNone'
          ? `No synteny track between ${rows} (set to None) — click to change`
          : status === 'noTrackAvailable'
            ? sameAssembly
              ? `Rows ${idx + 1} and ${idx + 2} both use ${assemblyName}, which only a self-alignment track can connect — they will stack with no ribbons. Click to configure.`
              : `No synteny dataset connects ${rows} — they will stack with no ribbons. Click to configure.`
            : `Configure synteny track between ${rows}`
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
          <Tooltip title={title}>
            <IconButton
              data-testid="synbutton"
              aria-label={title}
              className={cx(
                classes.synbutton,
                idx === selectedRow ? classes.bg : undefined,
                status === 'unfinishedUpload'
                  ? classes.synbuttonUnfinished
                  : undefined,
              )}
              onClick={() => {
                setSelectedRow(idx)
              }}
            >
              {status === 'unfinishedUpload' ? (
                <WarningAmberIcon />
              ) : status === 'configured' ? (
                <ArrowForwardIosIcon />
              ) : (
                // no ribbons here, which is a fact about the pair rather than a
                // problem to fix, so it reads as a broken link and not a warning
                <LinkOffIcon />
              )}
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
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  selectedRow: number
  setSelectedRow: (row: number) => void
  onLaunch: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  // computed once for the whole panel: the row icons, the Launch button and the
  // Auto-arrange offer are three views of the same answer, and each entry costs a
  // scan of the session's tracks
  const statusByPair = pairStatuses(model, session, selectedAssemblyNames)
  // a pair with nothing to draw is launchable: the rows just stack with no
  // ribbons. Only an upload the user started and hasn't finished blocks, since
  // launching would quietly drop it.
  const canLaunch = !statusByPair.includes('unfinishedUpload')
  // a reorder can only help a pair that has no dataset at all, not one the user
  // set to None on purpose
  const canReorder =
    selectedAssemblyNames.length > 2 &&
    statusByPair.includes('noTrackAvailable')

  // default the new row to an assembly that already has a synteny track to the
  // current bottom row, so the added pair actually draws ribbons rather than
  // stacking blank
  function addRow() {
    const bottom = selectedAssemblyNames.at(-1)!
    const connected = getConnectedAssemblies(allSessionTracks(session), bottom)
    setSelectedAssemblyNames([
      ...selectedAssemblyNames,
      connected[0] ?? session.assemblyNames[0] ?? bottom,
    ])
  }

  function autoArrangeRows() {
    const tracks = allSessionTracks(session)
    // no a !== b guard: getSyntenyTracks counts multiplicity, so a
    // self-alignment pair is connected exactly when a track names the assembly
    // twice, and the guard would pull apart a self-alignment adjacency this same
    // panel calls valid
    const reordered = planSyntenyChain(
      selectedAssemblyNames,
      (a, b) => getSyntenyTracks(tracks, [a, b]).length > 0,
    )
    // per-pair selections are indexed by row position, so a reorder invalidates
    // them. Pre-configured picks are dropped so doSubmit auto-picks for the new
    // ordering, but an upload carries a file the user entered by hand, so it
    // follows its assemblies to wherever the reorder put them.
    const uploads = remapUploadsToPairs(
      model.importFormSyntenyTrackSelections,
      reordered,
    )
    model.clearImportFormSyntenyTracks()
    for (const [pairIdx, upload] of uploads.entries()) {
      if (upload) {
        model.setImportFormSyntenyTrack(pairIdx, upload)
      }
    }
    setSelectedAssemblyNames(reordered)
    setSelectedRow(0)
  }

  return (
    <>
      <div className={classes.mb}>
        Select assemblies for linear synteny view
      </div>
      <div data-testid="synteny-assembly-rows">
        <AssemblyRows
          model={model}
          selectedAssemblyNames={selectedAssemblyNames}
          statusByPair={statusByPair}
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
            addRow()
          }}
        >
          Add row
        </Button>
        {canReorder ? (
          <Tooltip title="Reorder rows so adjacent pairs share a synteny dataset">
            <Button
              className={classes.button}
              variant="outlined"
              onClick={() => {
                autoArrangeRows()
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
              : 'Finish or clear the new synteny track on the highlighted row pair before launching'
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
