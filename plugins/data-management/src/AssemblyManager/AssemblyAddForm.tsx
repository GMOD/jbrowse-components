import React, { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import AddIcon from '@mui/icons-material/Add'
import {
  Button,
  DialogActions,
  DialogContent,
  Grid,
  MenuItem,
  Paper,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractRootModel, FileLocation } from '@jbrowse/core/util/types'

const AdapterSelector = observer(function ({
  adapterSelection,
  setAdapterSelection,
  adapterTypes,
}: {
  adapterSelection: string
  setAdapterSelection: (arg: string) => void
  adapterTypes: readonly string[]
}) {
  return (
    <TextField
      value={adapterSelection}
      label="Type"
      select
      helperText="Type of adapter to use"
      fullWidth
      onChange={event => {
        setAdapterSelection(event.target.value)
      }}
    >
      {adapterTypes.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </TextField>
  )
})

const AdapterInput = observer(function ({
  adapterSelection,
  fastaLocation,
  faiLocation,
  gziLocation,
  twoBitLocation,
  chromSizesLocation,
  setFaiLocation,
  setGziLocation,
  setTwoBitLocation,
  setFastaLocation,
  setChromSizesLocation,
}: {
  adapterSelection: string
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
  setGziLocation: (arg: FileLocation) => void
  setTwoBitLocation: (arg: FileLocation) => void
  setChromSizesLocation: (arg: FileLocation) => void
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
}) {
  if (
    adapterSelection === 'IndexedFastaAdapter' ||
    adapterSelection === 'BgzipFastaAdapter'
  ) {
    return (
      <>
        <div>
          <FileSelector
            inline
            name="fastaLocation"
            location={fastaLocation}
            setLocation={loc => {
              setFastaLocation(loc)
            }}
          />
        </div>
        <div>
          <FileSelector
            inline
            name="faiLocation"
            location={faiLocation}
            setLocation={loc => {
              setFaiLocation(loc)
            }}
          />
        </div>
        {adapterSelection === 'BgzipFastaAdapter' ? (
          <div>
            <FileSelector
              inline
              name="gziLocation"
              location={gziLocation}
              setLocation={loc => {
                setGziLocation(loc)
              }}
            />
          </div>
        ) : null}
      </>
    )
  }

  if (adapterSelection === 'TwoBitAdapter') {
    return (
      <>
        <div>
          <FileSelector
            inline
            name="twoBitLocation"
            location={twoBitLocation}
            setLocation={loc => {
              setTwoBitLocation(loc)
            }}
          />
        </div>
        <div>
          <FileSelector
            inline
            name="chromSizesLocation (optional, can be added to speed up loading 2bit files with many contigs)"
            location={chromSizesLocation}
            setLocation={loc => {
              setChromSizesLocation(loc)
            }}
          />
        </div>
      </>
    )
  }

  return null
})

const blank = { uri: '' } as FileLocation

const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'TwoBitAdapter',
] as const

const AssemblyAddForm = observer(function ({
  rootModel,
  onClose,
}: {
  rootModel: AbstractRootModel
  onClose: () => void
}) {
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [adapterSelection, setAdapterSelection] = useState(
    adapterTypes[0] as string,
  )
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)

  function createAssembly() {
    if (assemblyName === '') {
      rootModel.session?.notify("Can't create an assembly without a name")
    } else {
      onClose()
      let newAssembly: Record<string, unknown>
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
      } else {
        throw new Error(`unknown ${adapterSelection}`)
      }
      rootModel.jbrowse.addAssemblyConf(newAssembly)
      rootModel.session?.notify(
        `Successfully added ${assemblyName} assembly to JBrowse 2`,
        'success',
      )
    }
  }

  return (
    <>
      <DialogContent>
        <Paper>
          <TextField
            id="assembly-name"
            label="Assembly name"
            helperText="The assembly name e.g. hg38"
            variant="outlined"
            value={assemblyName}
            onChange={event => {
              setAssemblyName(event.target.value)
            }}
            slotProps={{
              htmlInput: { 'data-testid': 'assembly-name' },
            }}
          />
          <TextField
            id="assembly-name"
            label="Assembly display name"
            helperText='A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
            variant="outlined"
            value={assemblyDisplayName}
            onChange={event => {
              setAssemblyDisplayName(event.target.value)
            }}
            slotProps={{
              htmlInput: { 'data-testid': 'assembly-display-name' },
            }}
          />
          <AdapterSelector
            adapterSelection={adapterSelection}
            adapterTypes={adapterTypes}
            setAdapterSelection={setAdapterSelection}
          />
          <AdapterInput
            adapterSelection={adapterSelection}
            fastaLocation={fastaLocation}
            faiLocation={faiLocation}
            gziLocation={gziLocation}
            twoBitLocation={twoBitLocation}
            chromSizesLocation={chromSizesLocation}
            setFaiLocation={setFaiLocation}
            setGziLocation={setGziLocation}
            setTwoBitLocation={setTwoBitLocation}
            setFastaLocation={setFastaLocation}
            setChromSizesLocation={setChromSizesLocation}
          />
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<AddIcon />}
          onClick={createAssembly}
        >
          Create new assembly
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            onClose()
          }}
        >
          Back
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyAddForm
