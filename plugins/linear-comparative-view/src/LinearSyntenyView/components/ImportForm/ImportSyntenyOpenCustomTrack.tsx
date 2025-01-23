import { useEffect, useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import HelpIcon from '@mui/icons-material/Help'
import {
  Button,
  FormControlLabel,
  Grid2,
  Paper,
  Radio,
  RadioGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getAdapter } from './getAdapter'
import { basename, extName, getName, stripGz } from './util'

import type { LinearSyntenyViewModel } from '../../model'
import type { FileLocation } from '@jbrowse/core/util/types'

const ImportSyntenyOpenCustomTrack = observer(function ({
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
  const [error, setError] = useState<unknown>()
  const fileName = getName(fileLocation)

  const radioOption = value || (fileName ? extName(stripGz(fileName)) : '')

  useEffect(() => {
    try {
      if (fileLocation) {
        const fn = fileName ? basename(fileName) : 'MyTrack'
        const trackId = `${fn}-${Date.now()}-sessionTrack`
        setError(undefined)

        model.setImportFormSyntenyTrack(selectedRow, {
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
  const helpStrings = {
    '.paf': 'minimap2 target.fa query.fa',
    '.pif.gz': 'minimap2 target.fa query.fa',
    '.out': 'mashmap target.fa query.fa',
    '.delta': 'mummer target.fa query.fa',
    '.chain': 'e.g. queryToTarget.chain',
  } as const
  return (
    <Paper style={{ padding: 12 }}>
      {error ? <ErrorMessage error={error} /> : null}
      <Typography style={{ textAlign: 'center' }}>
        Add a .paf (minimap2), .delta (Mummer), .chain (UCSC liftover), .anchors
        or .anchors.simple (MCScan), or .pif.gz (jbrowse CLI make-pif) file to
        view. These file types can also be gzipped.
      </Typography>
      <RadioGroup
        value={radioOption}
        onChange={event => {
          setValue(event.target.value)
        }}
      >
        <Grid2 container justifyContent="center">
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
        </Grid2>
      </RadioGroup>
      <Grid2 container justifyContent="center">
        {radioOption === '.paf' ||
        radioOption === '.out' ||
        radioOption === '.delta' ||
        radioOption === '.chain' ||
        radioOption === '.pif.gz' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <FileSelector
              name={`${radioOption} location`}
              inline
              description=""
              location={fileLocation}
              setLocation={loc => {
                setFileLocation(loc)
              }}
            />
            <div>
              <div>
                Verify or click swap
                <Tooltip title={<code>{helpStrings[radioOption]}</code>}>
                  <HelpIcon />
                </Tooltip>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <i>{swap ? assembly2 : assembly1}</i>
                  </div>
                  <div>query assembly</div>
                  <div>
                    <i>{swap ? assembly1 : assembly2}</i>
                  </div>
                  <div>target assembly</div>
                </div>
                <Button
                  variant="contained"
                  onClick={() => {
                    setSwap(!swap)
                  }}
                >
                  Swap?
                </Button>
              </div>
            </div>
          </div>
        ) : value === '.anchors' || value === '.anchors.simple' ? (
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
                inline
                name={value}
                location={fileLocation}
                setLocation={loc => {
                  setFileLocation(loc)
                }}
              />
              <FileSelector
                inline
                name="genome 1 .bed (left column of anchors file)"
                description=""
                location={bed1Location}
                setLocation={loc => {
                  setBed1Location(loc)
                }}
              />
              <FileSelector
                inline
                name="genome 2 .bed (right column of anchors file)"
                description=""
                location={bed2Location}
                setLocation={loc => {
                  setBed2Location(loc)
                }}
              />
            </div>
            <div
              style={{
                margin: 'auto',
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <div>
                  <i>{swap ? assembly2 : assembly1}</i>
                </div>
                <div>bed1 assembly</div>
                <div>
                  <i>{swap ? assembly1 : assembly2}</i>
                </div>
                <div>bed2 assembly</div>
              </div>
              <Button
                variant="contained"
                onClick={() => {
                  setSwap(!swap)
                }}
              >
                Swap?
              </Button>
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
      </Grid2>
    </Paper>
  )
})

export default ImportSyntenyOpenCustomTrack
