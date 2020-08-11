import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession, isSessionModelWithWidgets } from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core/styles'

import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'

import { LinearSyntenyViewModel } from '../model'
import LinearComparativeViewComponent from '../../LinearComparativeView/components/LinearComparativeView'

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

const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx1, setSelectedAssemblyIdx1] = useState(0)
  const [selectedAssemblyIdx2, setSelectedAssemblyIdx2] = useState(0)
  const [error, setError] = useState('')
  const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
  if (!assemblyNames.length) {
    setError('No configured assemblies')
  }

  function onOpenClick() {
    model.setViews([
      { type: 'LinearGenomeView', bpPerPx: 0.1, offsetPx: 0 },
      { type: 'LinearGenomeView', bpPerPx: 0.1, offsetPx: 0 },
    ])
    // model.setAssemblyNames([
    //   assemblyNames[selectedAssemblyIdx1],
    //   assemblyNames[selectedAssemblyIdx2],
    // ])
  }

  return (
    <Container className={classes.importFormContainer}>
      <Grid container spacing={1} justify="center" alignItems="center">
        <Grid item>
          <TextField
            select
            variant="outlined"
            value={
              assemblyNames[selectedAssemblyIdx1] && !error
                ? selectedAssemblyIdx1
                : ''
            }
            onChange={event => {
              setSelectedAssemblyIdx1(Number(event.target.value))
            }}
            label="Assembly"
            helperText={error || 'Select assembly to view'}
            error={Boolean(error)}
            disabled={Boolean(error)}
            margin="normal"
            className={classes.importFormEntry}
          >
            {assemblyNames.map((name, idx) => (
              <MenuItem key={name} value={idx}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item>
          <TextField
            select
            variant="outlined"
            value={
              assemblyNames[selectedAssemblyIdx2] && !error
                ? selectedAssemblyIdx2
                : ''
            }
            onChange={event => {
              setSelectedAssemblyIdx2(Number(event.target.value))
            }}
            label="Assembly"
            helperText={error || 'Select assembly to view'}
            error={Boolean(error)}
            disabled={Boolean(error)}
            margin="normal"
            className={classes.importFormEntry}
          >
            {assemblyNames.map((name, idx) => (
              <MenuItem key={name} value={idx}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item>
          <Button onClick={onOpenClick} variant="contained" color="primary">
            Open
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

const LinearSyntenyView = observer(
  ({ model }: { model: LinearSyntenyViewModel }) => {
    const { initialized, loading } = model
    if (!initialized && !loading) {
      return <ImportForm model={model} />
    }
    return <LinearComparativeViewComponent model={model} />
  },
)

export default LinearSyntenyView
