import { useEffect, useMemo, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import GetAppIcon from '@mui/icons-material/GetApp'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getRpcSessionId } from '../../../util/tracks'

import type { FileTypeExporter } from '../saveTrackFileTypes/types'
import type {
  AbstractSessionModel,
  AbstractTrackModel,
  Feature,
  Region,
} from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()({
  root: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
    whiteSpace: 'pre',
  },
})

async function fetchFeatures(track: IAnyStateTreeNode, regions: Region[]) {
  const { rpcManager } = getSession(track)
  const adapterConfig = getConf(track, ['adapter'])
  const sessionId = getRpcSessionId(track)
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
  }) as Promise<Feature[]>
}

async function stringifyExportData(
  features: Feature[],
  type: string,
  options: Record<string, FileTypeExporter>,
  session: AbstractSessionModel,
  visibleRegions: Region[],
) {
  return options[type]!.callback({
    features,
    session,
    assemblyName: visibleRegions[0]!.assemblyName,
  })
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
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [helpDialogContent, setHelpDialogContent] = useState('')

  // @ts-expect-error
  const view = getContainingView(model) as {
    coarseVisibleLocStrings: string[]
    visibleRegions?: Region[]
  }

  const { visibleRegions, coarseVisibleLocStrings: regionStr } = view

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setError(undefined)
        setLoading(true)
        const session = getSession(model)
        if (!visibleRegions?.length || !type) {
          return
        }

        // Check if adapter supports export for this format
        const { pluginManager } = getEnv(model)
        const adapterConfig = getConf(model, ['adapter'])
        const adapterType = pluginManager.getAdapterType(adapterConfig.type)
        const supportsExport =
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          adapterType?.adapterCapabilities?.includes('exportData')

        if (supportsExport) {
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
          const features = await fetchFeatures(model, visibleRegions)
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
  }, [type, visibleRegions, options, model])

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
              <div
                key={key}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <FormControlLabel
                  value={key}
                  control={<Radio />}
                  label={val.name}
                />
                {val.helpText ? (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setHelpDialogContent(val.helpText!)
                      setHelpDialogOpen(true)
                    }}
                    title="Show help for this format"
                  >
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </div>
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
          onClick={async () => {
            const ext = options[type!]!.extension
            const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })

            // eslint-disable-next-line @typescript-eslint/no-deprecated
            const { saveAs } = await import('file-saver-es')
            saveAs(blob, `jbrowse_track_data.${ext}`, { autoBom: false })
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

      <Dialog
        open={helpDialogOpen}
        onClose={() => {
          setHelpDialogOpen(false)
        }}
      >
        <DialogTitle>Format Information</DialogTitle>
        <DialogContent>
          <DialogContentText>{helpDialogContent}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            autoFocus
            onClick={() => {
              setHelpDialogOpen(false)
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
})

export default SaveTrackDataDialog
