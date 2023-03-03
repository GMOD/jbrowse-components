import React, { useState, useEffect } from 'react'
import { SnapshotIn } from 'mobx-state-tree'
import path from 'path'
import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

function getName(
  sessionTrackData?: { uri: string } | { localPath: string } | { name: string },
) {
  return sessionTrackData
    ? // @ts-expect-error
      sessionTrackData.uri ||
        // @ts-expect-error
        sessionTrackData.localPath ||
        // @ts-expect-error
        sessionTrackData.name
    : undefined
}

function stripGz(fileName: string) {
  return fileName.endsWith('.gz') ? fileName.slice(0, -3) : fileName
}

function getAdapter({
  radioOption,
  assembly1,
  assembly2,
  fileLocation,
  bed1Location,
  bed2Location,
}: {
  radioOption: string
  assembly1: string
  assembly2: string
  fileLocation?: FileLocation
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
  } else {
    throw new Error('Unknown type')
  }
}

type Conf = SnapshotIn<AnyConfigurationModel>

const OpenTrack = observer(
  ({
    sessionTrackData,
    assembly1,
    assembly2,
    setSessionTrackData,
  }: {
    sessionTrackData: Conf
    assembly1: string
    assembly2: string
    setSessionTrackData: (arg: Conf) => void
  }) => {
    const [bed2Location, setBed2Location] = useState<FileLocation>()
    const [bed1Location, setBed1Location] = useState<FileLocation>()
    const [fileLocation, setFileLocation] = useState<FileLocation>()
    const [value, setValue] = useState('')
    const [error, setError] = useState<unknown>()
    const fileName = getName(fileLocation)

    const radioOption =
      value || (fileName ? path.extname(stripGz(fileName)) : '')

    useEffect(() => {
      try {
        if (fileLocation) {
          const fn = fileName ? path.basename(fileName) : 'MyTrack'
          const trackId = `${fn}-${Date.now()}`
          setError(undefined)

          setSessionTrackData({
            trackId,
            name: fn,
            assemblyNames: [assembly2, assembly1],
            type: 'SyntenyTrack',
            adapter: getAdapter({
              radioOption,
              assembly1,
              assembly2,
              fileLocation,
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
      radioOption,
      setSessionTrackData,
    ])
    return (
      <Paper style={{ padding: 12 }}>
        {error ? <ErrorMessage error={error} /> : null}
        <Typography style={{ textAlign: 'center' }}>
          Add a .paf, .out (MashMap), .delta (Mummer), .chain, .anchors or
          .anchors.simple (MCScan) file to view in the dotplot. These file types
          can also be gzipped. The first assembly should be the query sequence
          (e.g. left column of the PAF) and the second assembly should be the
          target sequence (e.g. right column of the PAF)
        </Typography>
        <RadioGroup
          value={radioOption}
          onChange={event => setValue(event.target.value)}
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
          </Grid>
        </RadioGroup>
        <Grid container justifyContent="center">
          <Grid item>
            {value === '.anchors' || value === '.anchors.simple' ? (
              <div>
                <div style={{ margin: 20 }}>
                  Open the {value} and .bed files for both genome assemblies
                  from the MCScan (Python version) pipeline{' '}
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
                      setLocation={loc => setFileLocation(loc)}
                    />
                  </div>
                  <div>
                    <FileSelector
                      name="genome 1 .bed (left column of anchors file)"
                      description=""
                      location={bed1Location}
                      setLocation={loc => setBed1Location(loc)}
                    />
                  </div>
                  <div>
                    <FileSelector
                      name="genome 2 .bed (right column of anchors file)"
                      description=""
                      location={bed2Location}
                      setLocation={loc => setBed2Location(loc)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <FileSelector
                name={value ? value + ' location' : ''}
                description=""
                location={fileLocation}
                setLocation={loc => setFileLocation(loc)}
              />
            )}
          </Grid>
        </Grid>
      </Paper>
    )
  },
)

export default OpenTrack
