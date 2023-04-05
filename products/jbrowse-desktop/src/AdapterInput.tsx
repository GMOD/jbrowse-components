import React from 'react'
import { Grid } from '@mui/material'
import { FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'

export default function AdapterInput({
  adapterSelection,
  fastaLocation,
  setFastaLocation,
  faiLocation,
  setFaiLocation,
  chromSizesLocation,
  gziLocation,
  setGziLocation,
  twoBitLocation,
  setTwoBitLocation,
  setChromSizesLocation,
}: {
  adapterSelection: string
  fastaLocation: FileLocation
  setFastaLocation: Function
  faiLocation: FileLocation
  setFaiLocation: Function
  gziLocation: FileLocation
  chromSizesLocation: FileLocation
  setGziLocation: Function
  twoBitLocation: FileLocation
  setTwoBitLocation: Function
  setChromSizesLocation: Function
}) {
  if (adapterSelection === 'IndexedFastaAdapter') {
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
      </Grid>
    )
  }
  if (adapterSelection === 'BgzipFastaAdapter') {
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
        <Grid item>
          <FileSelector
            name="gziLocation"
            location={gziLocation}
            setLocation={loc => setGziLocation(loc)}
          />
        </Grid>
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

  if (adapterSelection === 'FastaAdapter') {
    return (
      <Grid container spacing={2}>
        <Grid item>
          <FileSelector
            name="fastaLocation"
            location={fastaLocation}
            setLocation={loc => setFastaLocation(loc)}
          />
        </Grid>
      </Grid>
    )
  }

  return null
}
