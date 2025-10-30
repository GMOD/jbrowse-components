import { useEffect, useMemo, useState } from 'react'

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
import { getRpcSessionId } from '../../../util/tracks'

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

async function stringifyExportData(
  features: Feature[] | undefined,
  type: string,
  options: Record<string, FileTypeExporter>,
  session: AbstractSessionModel,
  visibleRegions: Region[],
): Promise<string | null> {
  if (!features) {
    return null
  }
  const generator = options[type] || {
    callback: () => 'Unknown',
  }
  return generator.callback({
    features,
    session,
    assemblyName: visibleRegions[0]!.assemblyName,
  })
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
  const { classes } = useStyles()
  const options = useMemo(() => model.saveTrackFileFormatOptions(), [model])
  const [error, setError] = useState<unknown>()
  const [type, setType] = useState(Object.keys(options)[0])
  const [str, setStr] = useState('')
  const [usedAdapterExport, setUsedAdapterExport] = useState(false)
  const [loading, setLoading] = useState(false)

  // @ts-expect-error
  const regionStr = getContainingView(model).coarseVisibleLocStrings

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setLoading(true)
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

        if (supportsExport) {
          // Try to use adapter's getExportData method via RPC
          const { rpcManager } = session
          const sessionId = getRpcSessionId(model)
          const exportResult = (await rpcManager.call(
            'getExportData',
            'CoreGetExportData',
            {
              adapterConfig,
              regions: visibleRegions,
              formatType: type,
              sessionId,
            },
          )) as string | undefined

          setUsedAdapterExport(true)
          setStr(exportResult || 'No export data received')
        } else {
          const view = getContainingView(model) as { visibleRegions?: Region[] }
          setError(undefined)
          const visibleRegions = view.visibleRegions || []
          const features = await fetchFeatures(model, visibleRegions)
          // Use stringify callback
          const stringifyResult = await stringifyExportData(
            features,
            type,
            options,
            session,
            visibleRegions,
          )

          setUsedAdapterExport(false)
          setStr(stringifyResult || 'No stringify result received')
        }
      } catch (e) {
        setError(e)
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [type, options, model])

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Save track data">
      <DialogContent className={classes.root}>
        {error ? <ErrorMessage error={error} /> : null}

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
              : str.length > 500_000
                ? 'File greater than 500kb, too large to view here. Click "Download" to results to file'
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
