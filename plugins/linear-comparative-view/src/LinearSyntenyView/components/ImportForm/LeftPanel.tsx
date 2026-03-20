import { useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

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

function rowNeedsConfiguration(model: LinearSyntenyViewModel, idx: number) {
  const selection = model.importFormSyntenyTrackSelections[idx]
  if (!selection) {
    return true
  }
  if (selection.type === 'preConfigured' && !selection.value) {
    return true
  }
  return false
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
    <div key={`${assemblyName}-${idx}`} className={classes.rel}>
      <span>Row {idx + 1}: </span>

      <IconButton
        disabled={selectedAssemblyNames.length <= 2}
        onClick={() => {
          model.importFormRemoveRow(idx)
          setSelectedAssemblyNames(
            selectedAssemblyNames
              .map((asm, idx2) => (idx2 === idx ? undefined : asm))
              .filter(notEmpty),
          )
          if (selectedRow >= selectedAssemblyNames.length - 2) {
            setSelectedRow(0)
          }
        }}
      >
        <CloseIcon />
      </IconButton>
      <AssemblySelector
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
      {idx !== selectedAssemblyNames.length - 1 ? (
        <Tooltip title="Click to configure synteny track for this row pair">
          <IconButton
            data-testid="synbutton"
            className={cx(
              classes.synbutton,
              idx === selectedRow ? classes.bg : undefined,
              rowNeedsConfiguration(model, idx)
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

function BulkAddButton({
  selectedAssemblyNames,
  setSelectedAssemblyNames,
}: {
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  return (
    <>
      <Button
        variant="outlined"
        color="secondary"
        size="small"
        sx={{ mx: 1 }}
        onClick={() => {
          setOpen(true)
        }}
      >
        Add multiple
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
        }}
      >
        <DialogTitle>Add multiple assemblies</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            rows={6}
            fullWidth
            placeholder="Paste assembly names, one per line"
            value={text}
            onChange={e => {
              setText(e.target.value)
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              const newNames = text
                .split(/\n/)
                .map(s => s.trim())
                .filter(s => s.length > 0)
              if (newNames.length > 0) {
                setSelectedAssemblyNames([
                  ...selectedAssemblyNames,
                  ...newNames,
                ])
              }
              setOpen(false)
              setText('')
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

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
  const numRowPairs = selectedAssemblyNames.length - 1
  const canLaunch = !Array.from({ length: numRowPairs }, (_, i) => i).some(i =>
    rowNeedsConfiguration(model, i),
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
          variant="contained"
          color="secondary"
          onClick={() => {
            setSelectedAssemblyNames([
              ...selectedAssemblyNames,
              defaultAssemblyName,
            ])
          }}
        >
          Add row
        </Button>
        <BulkAddButton
          selectedAssemblyNames={selectedAssemblyNames}
          setSelectedAssemblyNames={setSelectedAssemblyNames}
        />
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
