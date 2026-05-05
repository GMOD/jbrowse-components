import { useEffect, useMemo, useRef, useState } from 'react'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
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
import { observer } from 'mobx-react'

import { fetchTrackData } from './fetchTrackData.ts'
import { Dialog, ErrorBanner } from '../../../ui/index.ts'
import { getContainingView, saveAs } from '../../../util/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'

import type { AnyConfigurationModel } from '../../../configuration/index.ts'
import type { Region } from '../../../util/index.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const useStyles = makeStyles()({
  root: { width: '80em' },
  textAreaFont: {
    fontFamily: 'Courier New',
    whiteSpace: 'pre',
  },
  formatRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
})

function HelpDialog({
  text,
  onClose,
}: {
  text: string | undefined
  onClose: () => void
}) {
  return (
    <Dialog open={text !== undefined} onClose={onClose}>
      <DialogTitle>Format Information</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const SaveTrackDataDialog = observer(function SaveTrackDataDialog({
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
  const [result, setResult] = useState({ str: '', usedAdapterExport: false })
  const [loading, setLoading] = useState(false)
  const [helpText, setHelpText] = useState<string>()
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const view = getContainingView(model) as unknown as {
    coarseVisibleLocStrings: string[]
    visibleRegions?: Region[]
  }
  const { visibleRegions, coarseVisibleLocStrings: regionStr } = view

  useEffect(() => {
    const ctl = { cancelled: false }

    async function load() {
      try {
        setError(undefined)
        setLoading(true)
        if (!visibleRegions?.length || !type) {
          return
        }
        const data = await fetchTrackData(model, visibleRegions, type, options)
        if (ctl.cancelled) {
          return
        }
        setResult(data)
      } catch (e) {
        if (!ctl.cancelled) {
          setError(e)
          console.error(e)
        }
      } finally {
        if (!ctl.cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      ctl.cancelled = true
    }
  }, [type, visibleRegions, options, model])

  const { str, usedAdapterExport } = result

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Save track data">
      <DialogContent className={classes.root}>
        {error ? <ErrorBanner error={error} /> : null}
        <div>
          <TextField
            label="Region"
            value={regionStr}
            slotProps={{ input: { readOnly: true } }}
          />
        </div>
        <FormControl>
          <FormLabel>
            {`File type${usedAdapterExport ? ' (adapter export)' : ''}`}
          </FormLabel>
          <RadioGroup
            value={type}
            onChange={e => {
              setType(e.target.value)
            }}
          >
            {Object.entries(options).map(([key, val]) => (
              <div key={key} className={classes.formatRow}>
                <FormControlLabel
                  value={key}
                  control={<Radio />}
                  label={val.name}
                />
                {val.helpText ? (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setHelpText(val.helpText)
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
              classes: { input: classes.textAreaFont },
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
            clearTimeout(copyTimer.current)
            copyTimer.current = setTimeout(() => {
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
            saveAs(
              new Blob([str], { type: 'text/plain;charset=utf-8' }),
              `jbrowse_track_data.${ext}`,
            )
          }}
          startIcon={<GetAppIcon />}
        >
          Download
        </Button>
        <Button variant="contained" type="submit" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
      <HelpDialog
        text={helpText}
        onClose={() => {
          setHelpText(undefined)
        }}
      />
    </Dialog>
  )
})

export default SaveTrackDataDialog
