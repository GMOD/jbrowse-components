import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getAdapter } from './getAdapter'
import {
  AnchorsFileSelector,
  PifGzSelector,
  SyntenyFileSelector,
} from './selectors'
import { basename, extName, getName, stripGz } from './util'

import type { DotplotViewModel } from '../../model'
import type { FileLocation } from '@jbrowse/core/util/types'

const ImportSyntenyOpenCustomTrack = observer(
  function ImportSyntenyOpenCustomTrack({
    model,
    assembly1,
    assembly2,
  }: {
    model: DotplotViewModel
    assembly1: string
    assembly2: string
  }) {
    const [swap, setSwap] = useState(false)
    const [bed2Location, setBed2Location] = useState<FileLocation>()
    const [bed1Location, setBed1Location] = useState<FileLocation>()
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [indexFileLocation, setIndexFileLocation] = useState<FileLocation>()
    const [value, setValue] = useState('')
    const [error, setError] = useState<unknown>()
    const fileName = getName(fileLocation)

    const radioOption = value || (fileName ? extName(stripGz(fileName)) : '')

    useEffect(() => {
      try {
        if (fileLocation) {
          const fn = fileName ? basename(fileName) : 'MyTrack'
          const trackId = `${fn}-${Date.now()}-sessionTrack`
          setError(undefined)

          model.setImportFormSyntenyTrack(0, {
            type: 'userOpened',
            value: {
              trackId,
              name: fn,
              assemblyNames: [assembly2, assembly1],
              type: 'SyntenyTrack',
              adapter: getAdapter({
                radioOption,
                assembly1: swap ? assembly2 : assembly1,
                assembly2: swap ? assembly1 : assembly2,
                fileLocation,
                indexFileLocation,
                bed1Location,
                bed2Location,
              }),
            },
          })
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    }, [
      swap,
      model,
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
        {error ? <ErrorMessage error={error} /> : null}
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
          <Grid container justifyContent="center">
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
        <Grid container justifyContent="center">
          {radioOption === '.paf' ||
          radioOption === '.out' ||
          radioOption === '.delta' ||
          radioOption === '.chain' ? (
            <SyntenyFileSelector
              radioOption={radioOption}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
            />
          ) : radioOption === '.anchors' ||
            radioOption === '.anchors.simple' ? (
            <AnchorsFileSelector
              radioOption={radioOption}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
              bed1Location={bed1Location}
              setBed1Location={setBed1Location}
              bed2Location={bed2Location}
              setBed2Location={setBed2Location}
            />
          ) : radioOption === '.pif.gz' ? (
            <PifGzSelector
              radioOption={radioOption}
              fileLocation={fileLocation}
              setFileLocation={setFileLocation}
              assembly1={assembly1}
              assembly2={assembly2}
              swap={swap}
              setSwap={setSwap}
              indexFileLocation={indexFileLocation}
              setIndexFileLocation={setIndexFileLocation}
            />
          ) : null}
        </Grid>
      </Paper>
    )
  },
)

export default ImportSyntenyOpenCustomTrack
