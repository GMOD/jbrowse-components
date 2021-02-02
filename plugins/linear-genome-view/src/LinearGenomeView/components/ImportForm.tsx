/* eslint-disable no-nested-ternary */
import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot, Instance } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types/mst'
// material ui
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import TextField from '@material-ui/core/TextField'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
// other
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
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<string>()
  const [assemblyRegions, setAssemblyRegions] = useState<
    Instance<typeof Region>[]
  >([])
  const error = !assemblyNames.length ? 'No configured assemblies' : ''
  const assemblyName = assemblyNames[selectedAssemblyIdx]
  const displayName = assemblyName && !error ? selectedAssemblyIdx : ''

  useEffect(() => {
    let done = false
    ;(async () => {
      const assembly = await assemblyManager.waitForAssembly(assemblyName)
      if (!done && assembly && assembly.regions) {
        setSelectedRegion(assembly.regions[0].refName)
        setAssemblyRegions(assembly.regions)
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

  function handleSelectedRegion(input: string) {
    const newRegion: Instance<typeof Region> | undefined = assemblyRegions.find(
      region => selectedRegion === region.refName,
    )
    if (newRegion) {
      model.setDisplayedRegions([getSnapshot(newRegion)])
    } else {
      try {
        input && model.navToLocString(input, assemblyName)
      } catch (e) {
        console.warn(e)
        session.notify(`${e}`, 'warning')
      }
    }
  }

  function onOpenClick() {
    if (selectedRegion) {
      handleSelectedRegion(selectedRegion)
    }
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
          {assemblyName ? (
            selectedRegion && model.volatileWidth ? (
              <RefNameAutocomplete
                model={model}
                assemblyName={
                  error ? undefined : assemblyNames[selectedAssemblyIdx]
                }
                value={selectedRegion}
                onSelect={setSelectedRegion}
                TextFieldProps={{
                  margin: 'normal',
                  variant: 'outlined',
                  className: classes.importFormEntry,
                  helperText: 'Enter a sequence or locstring',
                  onKeyPress: event => {
                    const inputValue = (event.target as HTMLInputElement).value
                    if (event.key === 'Enter') {
                      handleSelectedRegion(inputValue)
                    }
                  },
                }}
              />
            ) : (
              <CircularProgress
                role="progressbar"
                color="inherit"
                size={20}
                disableShrink
              />
            )
          ) : null}
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
