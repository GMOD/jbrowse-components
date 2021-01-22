import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { makeStyles } from '@material-ui/core/styles'
import CircularProgress from '@material-ui/core/CircularProgress'
import { getSession } from '@jbrowse/core/util'
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import { Region } from '@jbrowse/core/util/types'
import RefNameAutocomplete from './RefNameAutocomplete'
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(2),
  },
  importFormEntry: {
    minWidth: 180,
  },
}))

const ImportForm = observer(({ model }: { model: LinearGenomeViewModel }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<
    Region | String | undefined
  >()
  const { assemblyNames, assemblyManager } = getSession(model)
  const error = !assemblyNames.length ? 'No configured assemblies' : ''
  const assemblyName = assemblyNames[selectedAssemblyIdx]
  const displayName = assemblyName && !error ? selectedAssemblyIdx : ''
  useEffect(() => {
    let done = false
    ;(async () => {
      const assembly = await assemblyManager.waitForAssembly(assemblyName)

      if (!done && assembly && assembly.regions) {
        // setSelectedRegion(assembly.regions[0].refName)
        setSelectedRegion(getSnapshot(assembly.regions[0]))
      }
    })()
    return () => {
      done = true
    }
  }, [assemblyManager, assemblyName])

  function onAssemblyChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setSelectedAssemblyIdx(Number(event.target.value))
  }

  function onOpenClick() {
    if (typeof selectedRegion === 'string') {
      console.log(selectedRegion)
    } else {
      model.setDisplayedRegions([selectedRegion])
    }
    // if (selectedRegion) {
    //   model.setDisplayedRegions([selectedRegion])
    // }
  }

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
          {selectedRegion && model.volatileWidth ? (
            <RefNameAutocomplete
              model={model}
              assemblyName={
                error ? undefined : assemblyNames[selectedAssemblyIdx]
              }
              // value={selectedRegion?.refName || selectedRegion}
              onSelect={setSelectedRegion}
              TextFieldProps={{
                margin: 'normal',
                variant: 'outlined',
                label: 'Sequence',
                className: classes.importFormEntry,
                helperText: 'Select sequence to view',
              }}
            />
          ) : (
            <CircularProgress
              role="progressbar"
              color="inherit"
              size={20}
              disableShrink
            />
          )}
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
