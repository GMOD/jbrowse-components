import { Suspense, useState } from 'react'

import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type {
  ImportFormSyntenyTrack,
  SyntenyFileFormatOption,
} from './SelectorTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const ImportSyntenyOpenCustomTrack = observer(
  function ImportSyntenyOpenCustomTrack({
    assembly1,
    assembly2,
    extensionPoint,
    baseFormats,
    pluginManager,
    onSetTrack,
  }: {
    assembly1: string
    assembly2: string
    extensionPoint: string
    baseFormats: SyntenyFileFormatOption[]
    pluginManager: PluginManager
    onSetTrack: (val: ImportFormSyntenyTrack) => void
  }) {
    const [radioOption, setRadioOption] = useState('')

    const formats = pluginManager.evaluateExtensionPoint(
      extensionPoint,
      baseFormats,
    ) as SyntenyFileFormatOption[]

    const selectedFormat = formats.find(f => f.extension === radioOption)

    return (
      <Paper style={{ padding: 12 }}>
        <Typography style={{ textAlign: 'center' }}>
          Add a .paf (minimap2), .delta (Mummer), .chain (UCSC liftover),
          .anchors or .anchors.simple (MCScan), or .pif.gz (jbrowse CLI
          make-pif) file to view. These file types can also be gzipped.
        </Typography>
        <RadioGroup
          value={radioOption}
          onChange={event => {
            setRadioOption(event.target.value)
            onSetTrack({ type: 'none' })
          }}
        >
          <Grid container sx={{ justifyContent: 'center' }}>
            {formats.map(f => (
              <FormControlLabel
                key={f.extension}
                value={f.extension}
                control={<Radio />}
                label={f.extension}
              />
            ))}
          </Grid>
        </RadioGroup>
        {selectedFormat ? (
          <Grid container sx={{ justifyContent: 'center' }}>
            <Suspense fallback={null}>
              <selectedFormat.Component
                key={radioOption}
                assembly1={assembly1}
                assembly2={assembly2}
                onAdapterChange={result => {
                  if (result) {
                    const trackId = `${result.name}-${Date.now()}-sessionTrack`
                    onSetTrack({
                      type: 'userOpened',
                      value: {
                        trackId,
                        name: result.name,
                        assemblyNames: [assembly2, assembly1],
                        type: 'SyntenyTrack',
                        adapter: result.adapter,
                      },
                    })
                  } else {
                    onSetTrack({ type: 'none' })
                  }
                }}
              />
            </Suspense>
          </Grid>
        ) : null}
      </Paper>
    )
  },
)

export default ImportSyntenyOpenCustomTrack
