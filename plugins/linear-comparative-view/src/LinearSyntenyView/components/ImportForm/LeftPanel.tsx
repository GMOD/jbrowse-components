import { Fragment } from 'react'

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
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  pairIndexAfterRowRemoval,
  reversedPairIndex,
} from '../../util/importFormRows.ts'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { ImportFormRows, PairStatus } from '@jbrowse/synteny-core'

const useStyles = makeStyles()(theme => ({
  header: {
    marginBottom: theme.spacing(1),
  },
  buttons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  // The connector is its own strip between two row strips rather than an
  // absolutely-positioned icon hanging off the row above. Absolute placement
  // put it at a hardcoded `top: 30` measured against AssemblySelector's height,
  // and it landed to the right of that row's own remove button, so it read as
  // belonging to one row instead of joining two.
  connector: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    // indented under the Select above it, so the rule and the icon sit inside
    // the stack rather than starting at its left edge
    paddingLeft: theme.spacing(3),
  },
  // the short vertical rule the icon sits on: what makes "between these two"
  // legible without reading the tooltip
  connectorLine: {
    width: 2,
    alignSelf: 'stretch',
    minHeight: 24,
    background: theme.palette.divider,
  },
  synbuttonUnfinished: {
    color: theme.palette.warning.main,
  },
  bg: {
    background: theme.palette.divider,
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
      <Fragment key={`${assemblyName}-${idx}`}>
        <div className={classes.row}>
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
        </div>
        {isPairRow ? (
          <div className={classes.connector}>
            <div className={classes.connectorLine} />
            <Tooltip title={title}>
              <IconButton
                data-testid="synbutton"
                aria-label={title}
                className={cx(
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
                  // no ribbons here, which is a fact about the pair rather than
                  // a problem to fix, so it reads as a broken link and not a
                  // warning
                  <LinkOffIcon />
                )}
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
      </Fragment>
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
    chromosomes,
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
      <Typography className={classes.header}>
        Select assemblies for linear synteny view
      </Typography>
      {/* off unless asked for — see useChromosomeFilters. One box per row makes
          this the form the disclosure matters most on: a five-row stack put five
          empty fields between the reader and Launch. */}
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
      <div data-testid="synteny-assembly-rows">
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
