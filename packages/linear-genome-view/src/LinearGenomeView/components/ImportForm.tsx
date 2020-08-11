import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { getSession } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import { Region } from '@gmod/jbrowse-core/util/types'
import RefNameAutocomplete from './RefNameAutocomplete'
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
  importFormEntry: {
    minWidth: 180,
  },
}))

const ImportForm = observer(({ model }: { model: LinearGenomeViewModelt }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<Region | undefined>()
  const { assemblyNames } = getSession(model)

  function onAssemblyChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setSelectedAssemblyIdx(Number(event.target.value))
  }

  function onOpenClick() {
    if (selectedRegion) {
      model.setDisplayedRegions([selectedRegion])
      model.setDisplayName(selectedRegion.assemblyName)
    }
  }
  const error = !assemblyNames.length ? 'No configured assemblies' : ''
  const displayName =
    assemblyNames[selectedAssemblyIdx] && !error ? selectedAssemblyIdx : ''
  return (
    <Container className={classes.importFormContainer}>
      <Grid container spacing={1} justify="center" alignItems="center">
        <Grid item>
          <TextField
            select
            variant="outlined"
            value={displayName}
            onChange={onAssemblyChange}
            label="Assembly"
            helperText={error || 'Select assembly to view'}
            error={!!error}
            disabled={!!error}
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
          <RefNameAutocomplete
            model={model}
            assemblyName={
              error ? undefined : assemblyNames[selectedAssemblyIdx]
            }
            onSelect={setSelectedRegion}
            TextFieldProps={{
              margin: 'normal',
              variant: 'outlined',
              label: 'Sequence',
              className: classes.importFormEntry,
              helperText: 'Select sequence to view',
            }}
          />
        </Grid>
        <Grid item>
          <Button
            disabled={!selectedRegion}
            onClick={onOpenClick}
            variant="contained"
            color="primary"
          >
            Open
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

export default ImportForm
