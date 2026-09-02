import { Suspense, useId, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  CircularProgress,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type {
  ImportFormSyntenyTrack,
  SyntenyFileFormatOption,
  SyntenyFileFormatsExtensionPoint,
} from './SelectorTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const useStyles = makeStyles()(theme => ({
  panel: {
    padding: theme.spacing(1.5),
  },
  // wraps rather than scrolling, but stays a left-aligned grid so the
  // extensions line up in a column the eye can run down
  formats: {
    display: 'flex',
    flexWrap: 'wrap',
    columnGap: theme.spacing(2),
  },
  body: {
    marginTop: theme.spacing(1),
  },
}))

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
    extensionPoint: SyntenyFileFormatsExtensionPoint
    baseFormats: SyntenyFileFormatOption[]
    pluginManager: PluginManager
    onSetTrack: (val: ImportFormSyntenyTrack) => void
  }) {
    const { classes } = useStyles()
    // the synteny form renders one of these per row pair, so a fixed id would
    // point every format group's label at the first one
    const labelId = useId()
    const [radioOption, setRadioOption] = useState('')

    const formats = pluginManager.evaluateExtensionPoint(
      extensionPoint,
      baseFormats,
    )

    const selectedFormat = formats.find(f => f.extension === radioOption)

    return (
      <Paper className={classes.panel}>
        {/* The tool that emits each format is on its own radio rather than in a
        sentence above them. A prose list has to be kept in step with the radios
        by hand (it had already lost .out, MashMap), and a plugin adding a
        format through the extension point can never edit it at all. */}
        <FormLabel id={labelId}>File format</FormLabel>
        <RadioGroup
          aria-labelledby={labelId}
          value={radioOption}
          onChange={event => {
            setRadioOption(event.target.value)
            // format picked but no file yet: stay in the pending upload state so
            // the row reads as unconfigured, not as an explicit "no track"
            onSetTrack({ type: 'userOpened' })
          }}
        >
          <div className={classes.formats}>
            {formats.map(f => (
              <FormControlLabel
                key={f.extension}
                value={f.extension}
                control={<Radio />}
                label={
                  f.producer ? (
                    <span>
                      {f.extension}{' '}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="span"
                      >
                        {f.producer}
                      </Typography>
                    </span>
                  ) : (
                    f.extension
                  )
                }
              />
            ))}
          </div>
        </RadioGroup>
        <Typography variant="body2" color="text.secondary">
          Any of these can also be gzipped.
        </Typography>
        {selectedFormat ? (
          <div className={classes.body}>
            <Suspense fallback={<CircularProgress size={20} />}>
              <selectedFormat.Component
                key={radioOption}
                assembly1={assembly1}
                assembly2={assembly2}
                onAdapterChange={result => {
                  if (result) {
                    const trackId = `${result.name}-${Date.now()}`
                    onSetTrack({
                      type: 'userOpened',
                      value: {
                        trackId,
                        name: result.name,
                        // [query, target] per the comparative-adapters
                        // convention (util.ts): assembly1 is the query row, so
                        // it stays index 0, matching the adapter's own
                        // queryAssembly/targetAssembly order
                        assemblyNames: [assembly1, assembly2],
                        type: 'SyntenyTrack',
                        adapter: result.adapter,
                      },
                    })
                  } else {
                    onSetTrack({ type: 'userOpened' })
                  }
                }}
              />
            </Suspense>
          </div>
        ) : null}
      </Paper>
    )
  },
)

export default ImportSyntenyOpenCustomTrack
