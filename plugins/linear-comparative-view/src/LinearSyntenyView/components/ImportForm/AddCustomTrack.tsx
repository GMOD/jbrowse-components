import React, { useState, useEffect } from 'react'
import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { basename, extName, getName, stripGz } from './util'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { SnapshotIn } from 'mobx-state-tree'

function getAdapter({
  radioOption,
  assembly1,
  assembly2,
  fileLocation,
  indexFileLocation,
  bed1Location,
  bed2Location,
}: {
  radioOption: string
  assembly1: string
  assembly2: string
  fileLocation?: FileLocation
  indexFileLocation?: FileLocation
  bed1Location?: FileLocation
  bed2Location?: FileLocation
}) {
  if (radioOption === '.paf') {
    return {
      type: 'PAFAdapter',
      pafLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.out') {
    return {
      type: 'MashMapAdapter',
      outLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.delta') {
    return {
      type: 'DeltaAdapter',
      deltaLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.chain') {
    return {
      type: 'ChainAdapter',
      chainLocation: fileLocation,
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  } else if (radioOption === '.anchors') {
    return {
      type: 'MCScanAnchorsAdapter',
      mcscanAnchorsLocation: fileLocation,
      bed1Location,
      bed2Location,
      assemblyNames: [assembly1, assembly2],
    }
  } else if (radioOption === '.anchors.simple') {
    return {
      type: 'MCScanSimpleAnchorsAdapter',
      mcscanSimpleAnchorsLocation: fileLocation,
      bed1Location,
      bed2Location,
      assemblyNames: [assembly1, assembly2],
    }
  } else if (radioOption === '.pif.gz') {
    return {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: fileLocation,
      index: { location: indexFileLocation },
      assemblyNames: [assembly1, assembly2],
    }
  } else {
    throw new Error(
      `Unknown to detect type ${radioOption} from filename (select radio button to clarify)`,
    )
  }
}

type Conf = SnapshotIn<AnyConfigurationModel>

const ImportCustomTrack = observer(function ({
  assembly1,
  assembly2,
  setUserOpenedSyntenyTrack,
}: {
  assembly1: string
  assembly2: string
  setUserOpenedSyntenyTrack: (arg: Conf) => void
}) {
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
        const trackId = `${fn}-${Date.now()}`
        setError(undefined)

        setUserOpenedSyntenyTrack({
          trackId,
          name: fn,
          assemblyNames: [assembly2, assembly1],
          type: 'SyntenyTrack',
          adapter: getAdapter({
            radioOption,
            assembly1,
            assembly2,
            fileLocation,
            indexFileLocation,
            bed1Location,
            bed2Location,
          }),
        })
      }
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [
    fileName,
    assembly1,
    assembly2,
    bed1Location,
    bed2Location,
    fileLocation,
    indexFileLocation,
    radioOption,
    setUserOpenedSyntenyTrack,
  ])
  return (
    <Paper style={{ padding: 12 }}>
      {error ? <ErrorMessage error={error} /> : null}
      <Typography style={{ textAlign: 'center' }}>
        Add a .paf, .out (MashMap), .delta (Mummer), .chain, .anchors or
        .anchors.simple (MCScan) file to view. These file types can also be
        gzipped. The first assembly should be the query sequence (e.g. left
        column of the PAF) and the second assembly should be the target sequence
        (e.g. right column of the PAF)
      </Typography>
      <RadioGroup
        value={radioOption}
        onChange={event => {
          setValue(event.target.value)
        }}
      >
        <Grid container justifyContent="center">
          <Grid item>
            <FormControlLabel value=".paf" control={<Radio />} label=".paf" />
          </Grid>
          <Grid item>
            <FormControlLabel value=".out" control={<Radio />} label=".out" />
          </Grid>

          <Grid item>
            <FormControlLabel
              value=".delta"
              control={<Radio />}
              label=".delta"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              value=".chain"
              control={<Radio />}
              label=".chain"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              value=".anchors"
              control={<Radio />}
              label=".anchors"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              value=".anchors.simple"
              control={<Radio />}
              label=".anchors.simple"
            />
          </Grid>
          <Grid item>
            <FormControlLabel
              value=".pif.gz"
              control={<Radio />}
              label=".pif.gz"
            />
          </Grid>
        </Grid>
      </RadioGroup>
      <Grid container justifyContent="center">
        <Grid item>
          {value === '.anchors' || value === '.anchors.simple' ? (
            <div>
              <div style={{ margin: 20 }}>
                Open the {value} and .bed files for both genome assemblies from
                the MCScan (Python version) pipeline{' '}
                <a href="https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)">
                  (more info)
                </a>
              </div>
              <div style={{ display: 'flex' }}>
                <div>
                  <FileSelector
                    name=".anchors file"
                    description=""
                    location={fileLocation}
                    setLocation={loc => {
                      setFileLocation(loc)
                    }}
                  />
                </div>
                <div>
                  <FileSelector
                    name="genome 1 .bed (left column of anchors file)"
                    description=""
                    location={bed1Location}
                    setLocation={loc => {
                      setBed1Location(loc)
                    }}
                  />
                </div>
                <div>
                  <FileSelector
                    name="genome 2 .bed (right column of anchors file)"
                    description=""
                    location={bed2Location}
                    setLocation={loc => {
                      setBed2Location(loc)
                    }}
                  />
                </div>
              </div>
            </div>
          ) : value === '.pif.gz' ? (
            <div style={{ display: 'flex' }}>
              <div>
                <FileSelector
                  name={`${value} location`}
                  description=""
                  location={fileLocation}
                  setLocation={loc => {
                    setFileLocation(loc)
                  }}
                />
              </div>
              <div>
                <FileSelector
                  name={`${value} index location`}
                  description=""
                  location={indexFileLocation}
                  setLocation={loc => {
                    setIndexFileLocation(loc)
                  }}
                />
              </div>
            </div>
          ) : (
            <FileSelector
              name={value ? `${value} location` : ''}
              description=""
              location={fileLocation}
              setLocation={loc => {
                setFileLocation(loc)
              }}
            />
          )}
        </Grid>
      </Grid>
    </Paper>
  )
})

export default ImportCustomTrack
