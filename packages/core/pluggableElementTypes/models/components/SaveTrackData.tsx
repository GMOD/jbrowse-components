import { useEffect, useMemo, useState } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getContainingView, getEnv, getSession } from '@jbrowse/core/util'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
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
import copy from 'copy-to-clipboard'
import { saveAs } from 'file-saver-es'
import { observer } from 'mobx-react'

import { getRpcSessionId } from '../../../util/tracks'

import type { FileTypeExporter } from '../saveTrackFileTypes/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
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
  const session = getSession(track)
  const { rpcManager, assemblyManager } = session
  const adapterConfig = getConf(track, ['adapter'])
  const sessionId = getRpcSessionId(track)

  // Get sequenceAdapter from assembly for CRAM/BAM adapters that need it
  const assemblyName = regions[0]?.assemblyName
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const seqAdapterConfig = assembly?.configuration?.sequence?.adapter
  const sequenceAdapter =
    seqAdapterConfig && isStateTreeNode(seqAdapterConfig)
      ? getSnapshot(seqAdapterConfig)
      : seqAdapterConfig

  // Call CoreGetRefNames first to set up sequenceAdapterConfig on the adapter
  // and perform ref name aliasing
  await rpcManager.call(sessionId, 'CoreGetRefNames', {
    adapterConfig,
    sequenceAdapter,
    sessionId,
  })

  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
  }) as Promise<Feature[]>
}

function roundRegions(regions: Region[]) {
  return regions.map(r => ({
    ...r,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }))
}

const SaveTrackDataDialog = observer(function ({
  model,
  handleClose,
}: {
  model: IAnyStateTreeNode & {
    configuration: AnyConfigurationModel
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
  const [copied, setCopied] = useState(false)

  const view = getContainingView(model) as unknown as {
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

        const regions = roundRegions(visibleRegions)
        if (supportsExport) {
          const { rpcManager } = session
          const sessionId = getRpcSessionId(model)
          const exportResult = (await rpcManager.call(
            'getExportData',
            'CoreGetExportData',
            {
              adapterConfig,
              regions,
              formatType: type,
              sessionId,
            },
          )) as string | undefined

          setUsedAdapterExport(true)
          setStr(exportResult ?? '')
        } else {
          const features = await fetchFeatures(model, regions)
          const result = await options[type]!.callback({
            features,
            session,
            assemblyName: regions[0]!.assemblyName,
          })

          setUsedAdapterExport(false)
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          setStr(result ?? '')
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
                ? 'File greater than 500kb, too large to view here. Click "Download" to save results to file'
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
          disabled={loading || !!error}
          onClick={() => {
            copy(str)
            setCopied(true)
            setTimeout(() => {
              setCopied(false)
            }, 1000)
          }}
          startIcon={<ContentCopyIcon />}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
        <Button
          disabled={loading || !!error}
          onClick={() => {
            const ext = options[type!]!.extension
            const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })

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
