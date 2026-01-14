import { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import type {
  AbstractSessionModel,
  FileLocation,
} from '@jbrowse/core/util/types'

const AdapterSelector = observer(function AdapterSelector({
  adapterSelection,
  setAdapterSelection,
  adapterTypes,
}: {
  adapterSelection: AdapterType
  setAdapterSelection: (arg: AdapterType) => void
  adapterTypes: readonly string[]
}) {
  return (
    <TextField
      value={adapterSelection}
      variant="outlined"
      select
      helperText="Type of adapter to use"
      fullWidth
      onChange={event => {
        setAdapterSelection(event.target.value as AdapterType)
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

const UnindexedFastaAdapterInput = observer(
  function UnindexedFastaAdapterInput({
    fastaLocation,
    setFastaLocation,
  }: {
    fastaLocation: FileLocation
    setFastaLocation: (arg: FileLocation) => void
  }) {
    return (
      <>
        <Alert severity="warning" style={{ margin: 8 }}>
          Note: a FASTA index will be generated on submit, might take a couple
          minutes and if the file is remote, it will be downloaded in full
        </Alert>
        <div>
          <FileSelector
            inline
            name="FASTA file"
            location={fastaLocation}
            setLocation={setFastaLocation}
          />
        </div>
      </>
    )
  },
)

const IndexedFastaAdapterInput = observer(function IndexedFastaAdapterInput({
  fastaLocation,
  faiLocation,
  setFaiLocation,
  setFastaLocation,
}: {
  fastaLocation: FileLocation
  faiLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <div>
        <FileSelector
          inline
          name="FASTA file"
          location={fastaLocation}
          setLocation={setFastaLocation}
        />
      </div>
      <div>
        <FileSelector
          inline
          name="FASTA index (.fai) file"
          location={faiLocation}
          setLocation={setFaiLocation}
        />
      </div>
    </>
  )
})

const BgzipFastaAdapterInput = observer(function BgzipFastaAdapterInput({
  fastaLocation,
  faiLocation,
  gziLocation,
  setFaiLocation,
  setGziLocation,
  setFastaLocation,
}: {
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  setGziLocation: (arg: FileLocation) => void
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <div>
        <FileSelector
          inline
          name="FASTA file (.fa.gz)"
          location={fastaLocation}
          setLocation={setFastaLocation}
        />
      </div>
      <div>
        <FileSelector
          inline
          name="FASTA index (.fai) file"
          location={faiLocation}
          setLocation={setFaiLocation}
        />
      </div>
      <div>
        <FileSelector
          inline
          name="FASTA gzip index (.gzi) file"
          location={gziLocation}
          setLocation={setGziLocation}
        />
      </div>
    </>
  )
})

const TwoBitAdapterInput = observer(function TwoBitAdapterInput({
  twoBitLocation,
  chromSizesLocation,
  setTwoBitLocation,
  setChromSizesLocation,
}: {
  twoBitLocation: FileLocation
  chromSizesLocation: FileLocation
  setTwoBitLocation: (arg: FileLocation) => void
  setChromSizesLocation: (arg: FileLocation) => void
}) {
  return (
    <>
      <div>
        <FileSelector
          inline
          name="2bit file"
          location={twoBitLocation}
          setLocation={setTwoBitLocation}
        />
      </div>
      <div>
        <FileSelector
          inline
          name=".chrom.sizes (optional, can speed up loading 2bit files with many contigs)"
          location={chromSizesLocation}
          setLocation={setChromSizesLocation}
        />
      </div>
    </>
  )
})

const blank = { uri: '' } as FileLocation

const adapterTypes = [
  'IndexedFastaAdapter',
  'BgzipFastaAdapter',
  'UnindexedFastaAdapter',
  'TwoBitAdapter',
] as const

type AdapterType =
  | 'IndexedFastaAdapter'
  | 'BgzipFastaAdapter'
  | 'UnindexedFastaAdapter'
  | 'TwoBitAdapter'

const AssemblyAddForm = observer(function AssemblyAddForm({
  session,
  onClose,
}: {
  session: AbstractSessionModel
  onClose: () => void
}) {
  const [assemblyName, setAssemblyName] = useState('')
  const [assemblyDisplayName, setAssemblyDisplayName] = useState('')
  const [adapterSelection, setAdapterSelection] = useState<AdapterType>(
    adapterTypes[0],
  )
  const [fastaLocation, setFastaLocation] = useState(blank)
  const [faiLocation, setFaiLocation] = useState(blank)
  const [gziLocation, setGziLocation] = useState(blank)
  const [twoBitLocation, setTwoBitLocation] = useState(blank)
  const [chromSizesLocation, setChromSizesLocation] = useState(blank)

  return (
    <>
      <DialogContent>
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
          id="assembly-display-name"
          label="Assembly display name"
          helperText='(optional) A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
          variant="outlined"
          value={assemblyDisplayName}
          onChange={event => {
            setAssemblyDisplayName(event.target.value)
          }}
          slotProps={{
            htmlInput: {
              'data-testid': 'assembly-display-name',
            },
          }}
        />
        <AdapterSelector
          adapterSelection={adapterSelection}
          adapterTypes={adapterTypes}
          setAdapterSelection={setAdapterSelection}
        />
        {adapterSelection === 'IndexedFastaAdapter' ? (
          <IndexedFastaAdapterInput
            fastaLocation={fastaLocation}
            faiLocation={faiLocation}
            setFaiLocation={setFaiLocation}
            setFastaLocation={setFastaLocation}
          />
        ) : adapterSelection === 'UnindexedFastaAdapter' ? (
          <UnindexedFastaAdapterInput
            fastaLocation={fastaLocation}
            setFastaLocation={setFastaLocation}
          />
        ) : adapterSelection === 'TwoBitAdapter' ? (
          <TwoBitAdapterInput
            twoBitLocation={twoBitLocation}
            chromSizesLocation={chromSizesLocation}
            setTwoBitLocation={setTwoBitLocation}
            setChromSizesLocation={setChromSizesLocation}
          />
        ) : (
          <BgzipFastaAdapterInput
            fastaLocation={fastaLocation}
            gziLocation={gziLocation}
            faiLocation={faiLocation}
            setFaiLocation={setFaiLocation}
            setGziLocation={setGziLocation}
            setFastaLocation={setFastaLocation}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            if (assemblyName === '') {
              session.notify("Can't create an assembly without a name")
            } else {
              onClose()

              // @ts-expect-error
              session.addAssembly({
                name: assemblyName,
                displayName: assemblyDisplayName,
                sequence: {
                  type: 'ReferenceSequenceTrack',
                  trackId: `${assemblyName}-${performance.now()}`,
                  adapter:
                    adapterSelection === 'IndexedFastaAdapter'
                      ? {
                          type: 'IndexedFastaAdapter',
                          fastaLocation,
                          faiLocation,
                        }
                      : adapterSelection === 'BgzipFastaAdapter'
                        ? {
                            type: 'BgzipFastaAdapter',
                            fastaLocation,
                            faiLocation,
                            gziLocation,
                          }
                        : adapterSelection === 'UnindexedFastaAdapter'
                          ? {
                              type: 'UnindexedFastaAdapter',
                              fastaLocation,
                            }
                          : {
                              type: 'TwoBitAdapter',
                              twoBitLocation,
                              chromSizesLocation,
                            },
                },
              })
              session.notify(`Added "${assemblyName}"`, 'success')
            }
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyAddForm
