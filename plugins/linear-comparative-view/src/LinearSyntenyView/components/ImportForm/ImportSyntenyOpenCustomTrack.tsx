import { useEffect, useState } from 'react'

import { ErrorBanner, FileSelector } from '@jbrowse/core/ui'
import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getAdapter } from './getAdapter.ts'
import {
  AnchorsSelector,
  PifGzSelector,
  StandardFormatSelector,
} from './selectors/index.ts'
import { basename, extName, getName, stripGz } from './util.ts'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const ImportSyntenyOpenCustomTrack = observer(
  function ImportSyntenyOpenCustomTrack({
    model,
    assembly1,
    assembly2,
    selectedRow,
  }: {
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }) {
    const [swap, setSwap] = useState(false)
    const [bed2Location, setBed2Location] = useState<FileLocation>()
    const [bed1Location, setBed1Location] = useState<FileLocation>()
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [indexFileLocation, setIndexFileLocation] = useState<FileLocation>()
    const [value, setValue] = useState('')
    const fileName = getName(fileLocation)

    const radioOption = value || (fileName ? extName(stripGz(fileName)) : '')

    let error: unknown
    if (fileLocation) {
      try {
        getAdapter({
          radioOption,
          assembly1: swap ? assembly2 : assembly1,
          assembly2: swap ? assembly1 : assembly2,
          fileLocation,
          indexFileLocation,
          bed1Location,
          bed2Location,
        })
      } catch (e) {
        error = e
      }
    }

    useEffect(() => {
      if (fileLocation && !error) {
        const fn = fileName ? basename(fileName) : 'MyTrack'
        const trackId = `${fn}-${Date.now()}-sessionTrack`
        const adapter = getAdapter({
          radioOption,
          assembly1: swap ? assembly2 : assembly1,
          assembly2: swap ? assembly1 : assembly2,
          fileLocation,
          indexFileLocation,
          bed1Location,
          bed2Location,
        })
        model.setImportFormSyntenyTrack(selectedRow, {
          type: 'userOpened',
          value: {
            trackId,
            name: fn,
            assemblyNames: [assembly2, assembly1],
            type: 'SyntenyTrack',
            adapter,
          },
        })
      }
    }, [
      error,
      swap,
      model,
      selectedRow,
      fileName,
      assembly1,
      assembly2,
      bed1Location,
      bed2Location,
      fileLocation,
      indexFileLocation,
      radioOption,
    ])
    return (
      <Paper style={{ padding: 12 }}>
        {error ? <ErrorBanner error={error} /> : null}
        <Typography style={{ textAlign: 'center' }}>
          Add a .paf (minimap2), .delta (Mummer), .chain (UCSC liftover),
          .anchors or .anchors.simple (MCScan), or .pif.gz (jbrowse CLI
          make-pif) file to view. These file types can also be gzipped.
        </Typography>
        <RadioGroup
          value={radioOption}
          onChange={event => {
            setValue(event.target.value)
          }}
        >
          <Grid container sx={{ justifyContent: 'center' }}>
            {[
              '.paf',
              '.delta',
              '.out',
              '.chain',
              '.anchors',
              '.anchors.simple',
              '.pif.gz',
            ].map(extension => (
              <FormControlLabel
                key={extension}
                value={extension}
                control={<Radio />}
                label={extension}
              />
            ))}
          </Grid>
        </RadioGroup>
        <Grid container sx={{ justifyContent: 'center' }}>
          {radioOption === '.paf' ||
          radioOption === '.out' ||
          radioOption === '.delta' ||
          radioOption === '.chain' ? (
            <StandardFormatSelector
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              radioOption={radioOption}
            />
          ) : radioOption === '.pif.gz' ? (
            <PifGzSelector
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              indexFileLocation={indexFileLocation}
              setIndexFileLocation={setIndexFileLocation}
              radioOption={radioOption}
            />
          ) : radioOption === '.anchors' ||
            radioOption === '.anchors.simple' ? (
            <AnchorsSelector
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              bed1Location={bed1Location}
              setBed1Location={setBed1Location}
              bed2Location={bed2Location}
              setBed2Location={setBed2Location}
              radioOption={radioOption}
            />
          ) : (
            <FileSelector
              name={value ? `${value} location` : ''}
              description=""
              location={fileLocation}
              setLocation={setFileLocation}
            />
          )}
        </Grid>
      </Paper>
    )
  },
)

export default ImportSyntenyOpenCustomTrack
