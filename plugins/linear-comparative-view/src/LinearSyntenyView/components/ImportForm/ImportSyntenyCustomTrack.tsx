import React, { useState, useEffect } from 'react'
import { SnapshotIn } from 'mobx-state-tree'
import {
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { basename, extName, getName, stripGz } from './util'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  m0: {
    margin: 0,
    padding: 1,
    marginRight: 5,
  },
  p12: {
    padding: 12,
  },
  mw: {
    maxWidth: 500,
  },
  mt: {
    margin: 10,
  },
})

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
  if (radioOption === '.pif.gz') {
    return {
      type: 'PairwiseIndexedPAFAdapter',
      pifGzLocation: fileLocation,
      index: { location: indexFileLocation },
      queryAssembly: assembly1,
      targetAssembly: assembly2,
    }
  }
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
    throw new Error(
      `Unknown to detect type ${radioOption} from filename (select radio button to clarify)`,
    )
  }
}

type Conf = SnapshotIn<AnyConfigurationModel>

function RadioButton({
  value,
  label,
}: {
  label: React.ReactElement
  value: string
}) {
  const { classes } = useStyles()
  return (
    <FormControlLabel
      value={value}
      className={classes.m0}
      control={<Radio className={classes.m0} />}
      label={label}
    />
  )
}

const ImportSyntenyCustomTrack = observer(function ({
  assembly1,
  assembly2,
  setSessionTrackData,
}: {
  sessionTrackData: Conf
  assembly1: string
  assembly2: string
  setSessionTrackData: (arg: Conf) => void
}) {
  const { classes } = useStyles()
  const [bed2Location, setBed2Location] = useState<FileLocation>()
  const [bed1Location, setBed1Location] = useState<FileLocation>()
  const [fileLocation, setFileLocation] = useState<FileLocation>()
  const [indexedFileLocation, setIndexedFileLocation] = useState<FileLocation>()
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
    <Paper className={classes.p12}>
      {error ? <ErrorMessage error={error} /> : null}
      Add a file to view
      <div>
        <RadioGroup
          value={radioOption}
          onChange={event => {
            setValue(event.target.value)
          }}
        >
          <RadioButton
            value=".paf"
            label={<div>.paf (e.g. from minimap2)</div>}
          />
          <RadioButton
            value=".out"
            label={<div>.out (e.g. from MashMap</div>}
          />
          <RadioButton
            value=".delta"
            label={<div>.delta (e.g. from Mummer)</div>}
          />
          <RadioButton
            value=".chain"
            label={<div>.chain (e.g. from UCSC liftover)</div>}
          />
          <RadioButton
            value=".anchors"
            label={<div>.anchors (e.g. from MCScan - python version)</div>}
          />
          <RadioButton
            value=".anchors.simple"
            label={
              <div>.anchors.simple (e.g. from MCScan - python version)</div>
            }
          />
          <RadioButton
            value=".pif.gz"
            label={<div>.pif.gz (e.g. from jbrowse make-pif</div>}
          />
        </RadioGroup>
        <div className={classes.mt}>
          <Typography>
            <b>Note 1</b>:These file types can also be gzipped.
          </Typography>
          <Typography>
            <b>Note 2</b>: The first assembly should be the query sequence (e.g.
            left column of the PAF) and the second assembly should be the target
            sequence (e.g. right column of the PAF)
          </Typography>
        </div>
        <div className={classes.mw}>
          {value === '.anchors' || value === '.anchors.simple' ? (
            <div>
              <div style={{ margin: 20 }}>
                Open the {value} and .bed files for both genome assemblies from
                the MCScan (Python version) pipeline{' '}
                <a href="https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)">
                  (more info)
                </a>
              </div>
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
          ) : value === '.pif.gz' ? (
            <div>
              <FileSelector
                name={value ? `${value} location` : ''}
                description=""
                location={fileLocation}
                setLocation={loc => {
                  setFileLocation(loc)
                }}
              />
              <FileSelector
                name={value ? `${value} index location` : ''}
                description=""
                location={indexedFileLocation}
                setLocation={loc => {
                  setIndexedFileLocation(loc)
                }}
              />
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
        </div>
      </div>
    </Paper>
  )
})

export default ImportSyntenyCustomTrack
