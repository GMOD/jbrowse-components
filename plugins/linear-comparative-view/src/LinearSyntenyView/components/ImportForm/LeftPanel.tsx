import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import {
  getConnectedAssemblies,
  getSyntenyTracks,
  pickSyntenyTrackId,
  planSyntenyChain,
} from '@jbrowse/synteny-core'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import { Button, IconButton, Tooltip } from '@mui/material'
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

// A row pair is configured if it has an explicit none/userOpened/specific
// preConfigured selection. An untouched (tracklist-default) row is fine as long
// as a synteny track exists for the pair, since doSubmit auto-picks the first.
function rowNeedsConfiguration(
  model: LinearSyntenyViewModel,
  session: AbstractSessionModel,
  selectedAssemblyNames: string[],
  idx: number,
) {
  const selection = model.importFormSyntenyTrackSelections[idx]
  const isExplicit =
    selection?.type === 'none' || selection?.type === 'userOpened'
  const picked = selection?.type === 'preConfigured' ? selection.value : ''
  const tracks = getSyntenyTracks(session.tracks, [
    selectedAssemblyNames[idx]!,
    selectedAssemblyNames[idx + 1]!,
  ])
  return !isExplicit && !pickSyntenyTrackId(picked, tracks)
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
  return selectedAssemblyNames.map((assemblyName, idx) => (
    // eslint-disable-next-line @eslint-react/no-array-index-key -- row position is the identity here; assembly names can repeat across rows
    <div key={`${assemblyName}-${idx}`} className={classes.rel}>
      <span>Row {idx + 1}: </span>
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
            disabled={selectedAssemblyNames.length <= 2}
            onClick={() => {
              model.importFormRemoveRow(idx)
              setSelectedAssemblyNames(
                selectedAssemblyNames.filter((_, idx2) => idx2 !== idx),
              )
              if (selectedRow >= selectedAssemblyNames.length - 2) {
                setSelectedRow(0)
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </span>
      </Tooltip>
      {idx !== selectedAssemblyNames.length - 1 ? (
        <Tooltip title="Click to configure synteny track for this row pair">
          <IconButton
            data-testid="synbutton"
            className={cx(
              classes.synbutton,
              idx === selectedRow ? classes.bg : undefined,
              rowNeedsConfiguration(model, session, selectedAssemblyNames, idx)
                ? classes.synbuttonNeedsConfig
                : undefined,
            )}
            onClick={() => {
              setSelectedRow(idx)
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>
        </Tooltip>
      ) : null}
    </div>
  ))
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
      <AssemblyRows
        model={model}
        selectedAssemblyNames={selectedAssemblyNames}
        setSelectedAssemblyNames={setSelectedAssemblyNames}
        selectedRow={selectedRow}
        setSelectedRow={setSelectedRow}
      />

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
        <Button
          className={classes.button}
          disabled={!canLaunch}
          onClick={onLaunch}
          variant="contained"
          color="primary"
        >
          Launch
        </Button>
      </div>
    </>
  )
})

export default LeftPanel
