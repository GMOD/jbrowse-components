import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ChromosomeFilter,
  allSessionTracks,
  getConnectedAssemblies,
  getSyntenyTracks,
  planSyntenyChain,
} from '@jbrowse/synteny-core'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Button, IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import {
  pairIndexAfterRowRemoval,
  reversedPairIndex,
} from '../../util/importFormRows.ts'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { ImportFormRows, PairStatus } from '@jbrowse/synteny-core'

const GUTTER = 32
const ROW_GAP = 8
const MARKER = 26

const useStyles = makeStyles()(theme => ({
  buttons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
    paddingLeft: GUTTER,
  },
  // Each pair's marker sits in a gutter left of the rows, centered on the gap
  // between its two rows, so it joins them without a strip of its own. A rule
  // through the gutter links the markers into one stack.
  rows: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: ROW_GAP,
    paddingLeft: GUTTER,
    '&::before': {
      content: '""',
      position: 'absolute',
      left: MARKER / 2 - 1,
      top: 20,
      bottom: 20,
      width: 2,
      background: theme.palette.divider,
    },
  },
  row: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  },
  marker: {
    position: 'absolute',
    left: -GUTTER,
    bottom: -ROW_GAP / 2,
    transform: 'translateY(50%)',
    zIndex: 1,
    width: MARKER,
    height: MARKER,
    padding: 0,
    background: theme.palette.background.paper,
    boxShadow: `0 0 0 1px ${theme.palette.divider}`,
    '&:hover': {
      background: theme.palette.action.hover,
    },
    '& svg': {
      fontSize: 14,
    },
  },
  markerSelected: {
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    boxShadow: 'none',
    '&:hover': {
      background: theme.palette.primary.dark,
    },
  },
  markerUnfinished: {
    color: theme.palette.warning.main,
  },
}))

const AssemblyRows = observer(function AssemblyRows({
  form,
  statusByPair,
  model,
}: {
  form: ImportFormRows
  statusByPair: PairStatus[]
  model: LinearSyntenyViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const {
    rows: selectedAssemblyNames,
    selectedPair: selectedRow,
    chromosomes,
    applyRows,
    setSelectedPair: setSelectedRow,
  } = form
  function removeRow(idx: number) {
    applyRows(
      selectedAssemblyNames.filter((_, i) => i !== idx),
      pairIndexAfterRowRemoval({
        rowCount: selectedAssemblyNames.length,
        removedRow: idx,
        selectedPair: selectedRow,
      }),
    )
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
      <div key={`${assemblyName}-${idx}`} className={classes.row}>
        <AssemblySelector
          label={`Row ${idx + 1} assembly`}
          helperText=""
          selected={assemblyName}
          onChange={newAssembly => {
            // through applyRows like every other row edit: the pairs this row
            // is part of are now different pairs, and whatever was configured
            // for the old ones has to go with them
            applyRows(
              selectedAssemblyNames.map((asm, idx2) =>
                idx2 === idx ? newAssembly : asm,
              ),
              selectedRow,
            )
          }}
          session={session}
        />
        {chromosomes.shown ? (
          <ChromosomeFilter
            label={`Row ${idx + 1} chromosomes`}
            testId={`chromosome-filter-row-${idx}`}
            value={chromosomes.get(idx)}
            onChange={value => {
              chromosomes.set(idx, value)
            }}
          />
        ) : null}
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
          <Tooltip title={title} placement="left">
            <IconButton
              data-testid="synbutton"
              aria-label={title}
              aria-pressed={idx === selectedRow}
              className={cx(
                classes.marker,
                idx === selectedRow ? classes.markerSelected : undefined,
                status === 'unfinishedUpload' && idx !== selectedRow
                  ? classes.markerUnfinished
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
                // no ribbons here, which is a fact about the pair rather than
                // a problem to fix, so it reads as a broken link and not a
                // warning
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
  statusByPair,
  form,
}: {
  model: LinearSyntenyViewModel
  // computed by the form, which also gates Launch on it, so the row icons and
  // the button can't disagree about what launching would do
  statusByPair: PairStatus[]
  form: ImportFormRows
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const {
    rows: selectedAssemblyNames,
    selectedPair: selectedRow,
    applyRows,
  } = form
  // a reorder can only help a pair that has no dataset at all, not one the user
  // set to None on purpose
  const canReorder =
    selectedAssemblyNames.length > 2 &&
    statusByPair.includes('noTrackAvailable')

  // Default the new row to an assembly connected to the current bottom row, so
  // the added pair draws ribbons rather than stacking blank — but one the stack
  // doesn't already hold. A two-row A/B form is connected only back to A, and
  // defaulting to it made "Add row" produce A/B/A: the same alignment a second
  // time, upside down, which is never what the button was clicked for. A new
  // assembly with no dataset yet is the honest answer instead, and the row's own
  // broken-link icon says so.
  function addRow() {
    const bottom = selectedAssemblyNames.at(-1)!
    const connected = getConnectedAssemblies(
      allSessionTracks(session),
      bottom,
      session.assemblyManager,
    )
    const notInStack = (name: string) => !selectedAssemblyNames.includes(name)
    applyRows(
      [
        ...selectedAssemblyNames,
        [...connected, ...session.assemblyNames].find(notInStack) ??
          connected[0] ??
          bottom,
      ],
      // select the pair it created, so the track panel is already showing the
      // thing the user just asked for rather than the pair they had been on
      selectedAssemblyNames.length - 1,
    )
  }

  function autoArrangeRows() {
    const tracks = allSessionTracks(session)
    // no a !== b guard: getSyntenyTracks counts multiplicity, so a
    // self-alignment pair is connected exactly when a track names the assembly
    // twice, and the guard would pull apart a self-alignment adjacency this same
    // panel calls valid
    //
    // The arrow resets to pair 0: this is a whole new ordering, so there is no
    // "the pair I was on" to stay with, unlike a reversal. Whatever was
    // configured for a pair that survives the reordering still follows it —
    // that part is applyRows' job, not this one's.
    applyRows(
      planSyntenyChain(
        selectedAssemblyNames,
        (a, b) =>
          getSyntenyTracks(tracks, [a, b], session.assemblyManager).length > 0,
      ),
      0,
    )
  }

  return (
    <>
      <div data-testid="synteny-assembly-rows" className={classes.rows}>
        <AssemblyRows model={model} statusByPair={statusByPair} form={form} />
      </div>

      <div className={classes.buttons}>
        <Button
          variant="outlined"
          onClick={() => {
            addRow()
          }}
        >
          Add row
        </Button>
        {/* Manual's counterpart to Quick start's Swap. Which genome is on top is
        the user's call rather than a property of the data (a synteny track
        answers in either direction), and without this the only way to flip a
        stack already filled in was to retype every Select. Auto-arrange doesn't
        cover it: it only fires for a pair with no dataset at all, so a fully
        connected stack had no reordering control whatsoever. */}
        <Tooltip title="Reverse the row order (flips the stack top to bottom)">
          <Button
            variant="outlined"
            onClick={() => {
              applyRows(
                [...selectedAssemblyNames].reverse(),
                reversedPairIndex({
                  rowCount: selectedAssemblyNames.length,
                  selectedPair: selectedRow,
                }),
              )
            }}
          >
            Reverse rows
          </Button>
        </Tooltip>
        {canReorder ? (
          <Tooltip title="Reorder rows so adjacent pairs share a synteny dataset">
            <Button
              variant="outlined"
              onClick={() => {
                autoArrangeRows()
              }}
            >
              Auto-arrange rows
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </>
  )
})

export default LeftPanel
