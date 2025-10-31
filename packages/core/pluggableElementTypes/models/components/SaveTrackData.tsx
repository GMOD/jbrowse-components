import React, { useEffect, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import GetAppIcon from '@mui/icons-material/GetApp'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { saveAs } from 'file-saver'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type {
  AbstractSessionModel,
  AbstractTrackModel,
  Feature,
  Region,
} from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

// icons

const useStyles = makeStyles()({
  root: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
    whiteSpace: 'pre',
  },
})

async function fetchFeatures(
  track: IAnyStateTreeNode,
  regions: Region[],
  signal?: AbortSignal,
) {
  const { rpcManager } = getSession(track)
  const adapterConfig = getConf(track, ['adapter'])
  const sessionId = 'getFeatures'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
    signal,
  }) as Promise<Feature[]>
}
interface FileTypeExporter {
  name: string
  extension: string
  callback: (arg: {
    features: Feature[]
    session: AbstractSessionModel
    assemblyName: string
  }) => Promise<string> | string
}
const SaveTrackDataDialog = observer(function ({
  model,
  handleClose,
}: {
  model: AbstractTrackModel & {
    saveTrackFileFormatOptions: () => Record<string, FileTypeExporter>
  }
  handleClose: () => void
}) {
  const options = model.saveTrackFileFormatOptions()
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [features, setFeatures] = useState<Feature[]>()
  const [type, setType] = useState(Object.keys(options)[0])
  const [str, setStr] = useState('')
  const [usedAdapterExport, setUsedAdapterExport] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const view = getContainingView(model) as { visibleRegions?: Region[] }
        setError(undefined)
        const visibleRegions = view.visibleRegions || []
        setFeatures(await fetchFeatures(model, visibleRegions))
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [model])

  // @ts-expect-error
  const regionStr = getContainingView(model).coarseVisibleLocStrings

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const { visibleRegions } = getContainingView(model) as {
          visibleRegions?: Region[]
        }
        const session = getSession(model)
        if (!visibleRegions?.length || !type) {
          return
        }

        // Check if adapter supports export for this format
        const { pluginManager } = getEnv(model)
        const adapterConfig = getConf(model, ['adapter'])
        const adapterType = pluginManager.getAdapterType(adapterConfig.type)
        const supportsExport =
          adapterType?.adapterCapabilities?.includes('exportData')

        let result: string
        let isAdapterExport = false

        if (supportsExport) {
          // Try to use adapter's getExportData method
          const { getAdapter } = await import(
            '@jbrowse/core/data_adapters/dataAdapterCache'
          )
          try {
            const adapter = await getAdapter(
              pluginManager,
              session,
              adapterConfig,
            )
            const exportResult = await adapter.getExportData?.(
              visibleRegions,
              type,
            )
            if (exportResult) {
              result = exportResult
              isAdapterExport = true
            } else {
              // Fall back to stringify if getExportData returns undefined
              if (!features) {
                return
              }
              const generator = options[type] || {
                callback: () => 'Unknown',
              }
              result = await generator.callback({
                features,
                session,
                assemblyName: visibleRegions[0]!.assemblyName,
              })
            }
          } catch (e) {
            // Fall back to stringify if adapter method fails
            if (!features) {
              return
            }
            const generator = options[type] || {
              callback: () => 'Unknown',
            }
            result = await generator.callback({
              features,
              session,
              assemblyName: visibleRegions[0]!.assemblyName,
            })
          }
        } else {
          // Use stringify callback
          if (!features) {
            return
          }
          const generator = options[type] || {
            callback: () => 'Unknown',
          }
          result = await generator.callback({
            features,
            session,
            assemblyName: visibleRegions[0]!.assemblyName,
          })
        }

        setUsedAdapterExport(isAdapterExport)
        setStr(result)
      } catch (e) {
        setError(e)
      }
    })()
  }, [type, features, options, model])

  const loading = !features
  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Save track data">
      <DialogContent className={classes.root}>
        {error ? <ErrorMessage error={error} /> : null}
        {features && !features.length ? (
          <Typography>No features found</Typography>
        ) : null}

        <div>
          <TextField
            label="Region"
            value={regionStr}
            slotProps={{
              input: {
                readOnly: true,
              },
            }}
          />
        </div>

        <FormControl>
          <FormLabel>
            File type {usedAdapterExport ? '(adapter export)' : ''}
          </FormLabel>
          <RadioGroup
            value={type}
            onChange={e => {
              setType(e.target.value)
            }}
          >
            {Object.entries(options).map(([key, val]) => (
              <FormControlLabel
                key={key}
                value={key}
                control={<Radio />}
                label={val.name}
              />
            ))}
          </RadioGroup>
        </FormControl>
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          maxRows={15}
          fullWidth
          value={
            loading
              ? 'Loading...'
              : str.length > 100_000
                ? 'Too large to view here, click "Download" to results to file'
                : str
          }
          slotProps={{
            input: {
              readOnly: true,
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            if (!type) {
              return
            }
            const ext = options[type]?.extension || 'unknown'
            const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })
            saveAs(blob, `jbrowse_track_data.${ext}`)
          }}
          startIcon={<GetAppIcon />}
        >
          Download
        </Button>

        <Button
          variant="contained"
          type="submit"
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SaveTrackDataDialog
