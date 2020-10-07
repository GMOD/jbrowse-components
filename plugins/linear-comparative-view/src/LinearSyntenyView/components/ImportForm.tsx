import React, { useState } from 'react'
import { observer } from 'mobx-react'
import AddIcon from '@material-ui/icons/Add'
import { getSnapshot } from 'mobx-state-tree'
import { getSession, when } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import { makeStyles } from '@material-ui/core/styles'
import IconButton from '@material-ui/core/IconButton'
import { LinearSyntenyViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
  importFormEntry: {
    minWidth: 180,
  },
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))
const FormRow = observer(
  ({
    model,
    selected,
    onChange,
    error,
  }: {
    model: LinearSyntenyViewModel
    selected: number
    onChange: (arg0: number) => void
    error?: string
  }) => {
    const classes = useStyles()
    const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
    return (
      <Grid container item justify="center" spacing={2} alignItems="center">
        <TextField
          select
          variant="outlined"
          value={assemblyNames[selected] ? selected : ''}
          onChange={event => {
            onChange(Number(event.target.value))
          }}
          error={Boolean(error)}
          disabled={Boolean(error)}
          margin="dense"
          className={classes.importFormEntry}
        >
          {assemblyNames.map((name, idx) => (
            <MenuItem key={name} value={idx}>
              {name}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
    )
  },
)
const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const [selected, setSelected] = useState([0, 0])
  const [error, setError] = useState('')
  const [numRows, setNumRows] = useState(2)
  const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
  if (!assemblyNames.length) {
    setError('No configured assemblies')
  }

  async function onOpenClick() {
    const { assemblyManager } = getSession(model)

    model.setViews(
      // @ts-ignore
      await Promise.all(
        selected
          .map(async selection => {
            const assembly = assemblyManager.get(assemblyNames[selection])
            if (assembly) {
              await when(() => Boolean(assembly.regions))
              return {
                type: 'LinearGenomeView',
                bpPerPx: 1,
                offsetPx: 0,
                hideHeader: true,
                // @ts-ignore
                displayedRegions: getSnapshot(assembly.regions),
              }
            }
            return null
          })
          .filter(f => !!f),
      ),
    )

    model.views.forEach(view => view.showAllRegions())
  }

  return (
    <Container className={classes.importFormContainer}>
      <p style={{ textAlign: 'center' }}>Select assemblies for synteny view</p>
      {[...new Array(numRows)].map((_, index) => (
        <FormRow
          key={`row_${index}_${selected[index]}`}
          error={error}
          selected={selected[index]}
          onChange={val => {
            const copy = selected.slice(0)
            copy[index] = val
            setSelected(copy)
          }}
          model={model}
        />
      ))}

      <Grid container item justify="center" spacing={4} alignItems="center">
        Add another assembly...
        <IconButton
          onClick={() => setNumRows(rows => rows + 1)}
          color="primary"
        >
          <AddIcon />
        </IconButton>
      </Grid>

      <Grid container item justify="center" spacing={4} alignItems="center">
        <Button onClick={onOpenClick} variant="contained" color="primary">
          Open
        </Button>
      </Grid>
    </Container>
  )
})

export default ImportForm
