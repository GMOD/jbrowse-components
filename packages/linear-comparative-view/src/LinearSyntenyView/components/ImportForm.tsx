import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getSession, when } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import { makeStyles } from '@material-ui/core/styles'
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

const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx1, setSelectedAssemblyIdx1] = useState(0)
  const [selectedAssemblyIdx2, setSelectedAssemblyIdx2] = useState(0)
  const [error, setError] = useState('')
  const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
  if (!assemblyNames.length) {
    setError('No configured assemblies')
  }

  async function onOpenClick() {
    const { assemblyManager } = getSession(model)
    const asm1 = assemblyNames[selectedAssemblyIdx1]
    const asm2 = assemblyNames[selectedAssemblyIdx2]
    const assembly1 = assemblyManager.get(asm1)
    const assembly2 = assemblyManager.get(asm2)
    if (assembly1 && assembly2) {
      await when(() => Boolean(assembly1.regions) && Boolean(assembly2.regions))
      if (assembly1.regions && assembly2.regions) {
        const regions1 = getSnapshot(assembly1.regions)
        const regions2 = getSnapshot(assembly2.regions)
        model.setViews([
          {
            type: 'LinearGenomeView',
            bpPerPx: 1,
            offsetPx: 0,
            hideHeader: true,
            displayedRegions: regions1,
          },
          {
            type: 'LinearGenomeView',
            bpPerPx: 1,
            offsetPx: 0,
            hideHeader: true,
            displayedRegions: regions2,
          },
        ])
        model.views.forEach(view => view.showAllRegions())
      }
    }
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

export default ImportForm
