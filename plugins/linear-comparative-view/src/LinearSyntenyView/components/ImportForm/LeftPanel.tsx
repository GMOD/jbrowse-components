import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession, notEmpty } from '@jbrowse/core/util'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CloseIcon from '@mui/icons-material/Close'
import { Button, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearSyntenyViewModel } from '../../model'

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
  bg: {
    background: theme.palette.divider,
  },
}))

const AssemblyRows = observer(function ({
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
  const { classes, cx } = useStyles()
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
        <IconButton
          data-testid="synbutton"
          className={cx(
            classes.synbutton,
            idx === selectedRow ? classes.bg : undefined,
          )}
          onClick={() => {
            setSelectedRow(idx)
          }}
        >
          <ArrowForwardIosIcon />
        </IconButton>
      ) : null}
    </div>
  ))
})

const LeftPanel = observer(function ({
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
        <Button
          className={classes.button}
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
