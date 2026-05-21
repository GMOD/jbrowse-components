import { FileSelector } from '@jbrowse/core/ui'
import { Stack } from '@mui/material'

import type { FileLocation } from '@jbrowse/core/util/types'

export default function AdapterInput({
  adapterSelection,
  fastaLocation,
  faiLocation,
  chromSizesLocation,
  gziLocation,
  twoBitLocation,
  setGziLocation,
  setFastaLocation,
  setFaiLocation,
  setTwoBitLocation,
  setChromSizesLocation,
}: {
  adapterSelection: string
  fastaLocation: FileLocation
  faiLocation: FileLocation
  gziLocation: FileLocation
  chromSizesLocation: FileLocation
  twoBitLocation: FileLocation
  setFastaLocation: (arg: FileLocation) => void
  setFaiLocation: (arg: FileLocation) => void
  setGziLocation: (arg: FileLocation) => void
  setTwoBitLocation: (arg: FileLocation) => void
  setChromSizesLocation: (arg: FileLocation) => void
}) {
  if (adapterSelection === 'IndexedFastaAdapter') {
    return (
      <Stack spacing={2}>
        <FileSelector
          name="fastaLocation"
          location={fastaLocation}
          setLocation={loc => {
            setFastaLocation(loc)
          }}
        />
        <FileSelector
          name="faiLocation"
          location={faiLocation}
          setLocation={loc => {
            setFaiLocation(loc)
          }}
        />
      </Stack>
    )
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
    return (
      <Stack spacing={2}>
        <FileSelector
          name="fastaLocation"
          location={fastaLocation}
          setLocation={loc => {
            setFastaLocation(loc)
          }}
        />
        <FileSelector
          name="faiLocation"
          location={faiLocation}
          setLocation={loc => {
            setFaiLocation(loc)
          }}
        />
        <FileSelector
          name="gziLocation"
          location={gziLocation}
          setLocation={loc => {
            setGziLocation(loc)
          }}
        />
      </Stack>
    )
  }

  if (adapterSelection === 'TwoBitAdapter') {
    return (
      <Stack spacing={2}>
        <FileSelector
          name="twoBitLocation"
          location={twoBitLocation}
          setLocation={loc => {
            setTwoBitLocation(loc)
          }}
        />
        <FileSelector
          name="chromSizesLocation (optional, can be added to speed up loading 2bit files with many contigs)"
          location={chromSizesLocation}
          setLocation={loc => {
            setChromSizesLocation(loc)
          }}
        />
      </Stack>
    )
  }

  if (adapterSelection === 'FastaAdapter') {
    return (
      <Stack spacing={2}>
        <FileSelector
          name="fastaLocation"
          location={fastaLocation}
          setLocation={loc => {
            setFastaLocation(loc)
          }}
        />
      </Stack>
    )
  }

  return null
}
