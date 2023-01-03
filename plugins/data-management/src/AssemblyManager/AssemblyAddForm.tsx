import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { Button, Grid, MenuItem, Paper, TextField } from '@mui/material'
import { FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'

// icons
import AddIcon from '@mui/icons-material/Add'

const AdapterSelector = observer(function ({
  adapterSelection,
  setAdapterSelection,
  adapterTypes,
}: {
  adapterSelection: string
  setAdapterSelection: Function
  adapterTypes: string[]
}) {
  return (
    <TextField
      value={adapterSelection}
      label="Type"
      select
      helperText="Type of adapter to use"
      fullWidth
      onChange={event => setAdapterSelection(event.target.value)}
    >
      {adapterTypes.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </TextField>
  )
})

const AdapterInput = observer(
  ({
    adapterSelection,
    fastaLocation,
    setFastaLocation,
    faiLocation,
    setFaiLocation,
    gziLocation,
    setGziLocation,
    twoBitLocation,
    setTwoBitLocation,
    chromSizesLocation,
    setChromSizesLocation,
  }: {
    adapterSelection: string
    fastaLocation: FileLocation
    setFastaLocation: Function
    faiLocation: FileLocation
    setFaiLocation: Function
    gziLocation: FileLocation
    setGziLocation: Function
    twoBitLocation: FileLocation
    setTwoBitLocation: Function
    chromSizesLocation: FileLocation
    setChromSizesLocation: Function
  }) => {
    if (
      adapterSelection === 'IndexedFastaAdapter' ||
      adapterSelection === 'BgzipFastaAdapter'
    ) {
      return (
        <Grid container spacing={2}>
          <Grid item>
            <FileSelector
              name="fastaLocation"
              location={fastaLocation}
              setLocation={loc => setFastaLocation(loc)}
            />
          </Grid>
          <Grid item>
            <FileSelector
              name="faiLocation"
              location={faiLocation}
              setLocation={loc => setFaiLocation(loc)}
            />
          </Grid>
          {adapterSelection === 'BgzipFastaAdapter' ? (
            <Grid item>
              <FileSelector
                name="gziLocation"
                location={gziLocation}
                setLocation={loc => setGziLocation(loc)}
              />
            </Grid>
          ) : null}
        </Grid>
      )
    }

    if (adapterSelection === 'TwoBitAdapter') {
      return (
        <Grid container spacing={2}>
          <Grid item>
            <FileSelector
              name="twoBitLocation"
              location={twoBitLocation}
              setLocation={loc => setTwoBitLocation(loc)}
            />
          </Grid>
          <Grid item>
            <FileSelector
              name="chromSizesLocation (optional, can be added to speed up loading 2bit files with many contigs)"
              location={chromSizesLocation}
              setLocation={loc => setChromSizesLocation(loc)}
            />
          </Grid>
        </Grid>
      )
    }

    return null
  },
)

const blank = { uri: '' } as FileLocation

const AssemblyAddForm = observer(function ({
  rootModel,
  setFormOpen,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rootModel: any
  setFormOpen: Function
}) {
  const adapterTypes = [
    'IndexedFastaAdapter',
    'BgzipFastaAdapter',
    'TwoBitAdapter',
  ]

  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [adapterSelection, setAdapterSelection] = useState(adapterTypes[0])
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)

  function createAssembly() {
    if (assemblyName === '') {
      rootModel.session.notify("Can't create an assembly without a name")
    } else {
      setFormOpen(false)
      let newAssembly
      if (adapterSelection === 'IndexedFastaAdapter') {
        newAssembly = {
          name: assemblyName,
          displayName: assemblyDisplayName,
          sequence: {
            adapter: {
              type: 'IndexedFastaAdapter',
              fastaLocation,
              faiLocation,
            },
          },
        }
      } else if (adapterSelection === 'BgzipFastaAdapter') {
        newAssembly = {
          name: assemblyName,
          displayName: assemblyDisplayName,
          sequence: {
            adapter: {
              type: 'BgzipFastaAdapter',
              fastaLocation,
              faiLocation,
              gziLocation,
            },
          },
        }
      } else if (adapterSelection === 'TwoBitAdapter') {
        newAssembly = {
          name: assemblyName,
          displayName: assemblyDisplayName,
          sequence: {
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation,
              chromSizesLocation,
            },
          },
        }
      }
      rootModel.jbrowse.addAssemblyConf(newAssembly)
      rootModel.session.notify(
        `Successfully added ${assemblyName} assembly to JBrowse 2`,
        'success',
      )
    }
  }

  return (
    <div>
      <Paper>
        <TextField
          id="assembly-name"
          inputProps={{ 'data-testid': 'assembly-name' }}
          label="Assembly name"
          helperText="The assembly name e.g. hg38"
          variant="outlined"
          value={assemblyName}
          onChange={event => setAssemblyName(event.target.value)}
        />
        <TextField
          id="assembly-name"
          inputProps={{ 'data-testid': 'assembly-display-name' }}
          label="Assembly display name"
          helperText='A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
          variant="outlined"
          value={assemblyDisplayName}
          onChange={event => setAssemblyDisplayName(event.target.value)}
        />
        <AdapterSelector
          adapterSelection={adapterSelection}
          setAdapterSelection={setAdapterSelection}
          adapterTypes={adapterTypes}
        />
        <AdapterInput
          adapterSelection={adapterSelection}
          fastaLocation={fastaLocation}
          setFastaLocation={setFastaLocation}
          faiLocation={faiLocation}
          setFaiLocation={setFaiLocation}
          gziLocation={gziLocation}
          setGziLocation={setGziLocation}
          twoBitLocation={twoBitLocation}
          setTwoBitLocation={setTwoBitLocation}
          chromSizesLocation={chromSizesLocation}
          setChromSizesLocation={setChromSizesLocation}
        />
      </Paper>
      <Button
        variant="contained"
        color="secondary"
        startIcon={<AddIcon />}
        onClick={createAssembly}
      >
        Create new assembly
      </Button>
    </div>
  )
})

export default AssemblyAddForm
