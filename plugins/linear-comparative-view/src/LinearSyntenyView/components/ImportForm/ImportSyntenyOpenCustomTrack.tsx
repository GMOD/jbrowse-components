import { useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import {
  FormControlLabel,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { defaultSyntenyFileFormats } from './defaultSyntenyFileFormats.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { SyntenyFileFormatOption } from './selectors/SelectorTypes.ts'

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
    const { pluginManager } = getEnv(model)
    const [radioOption, setRadioOption] = useState('')

    const formats = pluginManager.evaluateExtensionPoint(
      'LinearSyntenyView-SyntenyFileFormats',
      defaultSyntenyFileFormats,
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
            model.setImportFormSyntenyTrack(selectedRow, { type: 'none' })
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
            <selectedFormat.Component
              key={radioOption}
              assembly1={assembly1}
              assembly2={assembly2}
              onAdapterChange={result => {
                if (result) {
                  const trackId = `${result.name}-${Date.now()}-sessionTrack`
                  model.setImportFormSyntenyTrack(selectedRow, {
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
                  model.setImportFormSyntenyTrack(selectedRow, { type: 'none' })
                }
              }}
            />
          </Grid>
        ) : null}
      </Paper>
    )
  },
)

export default ImportSyntenyOpenCustomTrack
