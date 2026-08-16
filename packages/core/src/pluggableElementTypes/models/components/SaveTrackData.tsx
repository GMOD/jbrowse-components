import { useState } from 'react'

import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import GetAppIcon from '@mui/icons-material/GetApp'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import {
  Button,
  DialogContentText,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getConf } from '../../../configuration/index.ts'
import {
  CopyToClipboardButton,
  ErrorBanner,
  InfoDialog,
} from '../../../ui/index.ts'
import {
  assembleLocStrings,
  getContainingView,
  getDisplayStr,
  saveAs,
  statusProgressLabel,
} from '../../../util/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import { useFetch } from '../../../util/useFetch.ts'
import { fetchTrackData, roundRegions } from './fetchTrackData.ts'

import type { AnyConfigurationModel } from '../../../configuration/index.ts'
import type { Region } from '../../../util/index.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const MAX_PREVIEW_CHARS = 500_000

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

const SaveTrackDataDialog = observer(function SaveTrackDataDialog({
  model,
  handleClose,
}: {
  model: IStateTreeNode & {
    configuration: AnyConfigurationModel
    saveTrackFileFormatOptions: () => Record<string, FileTypeExporter>
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const options = model.saveTrackFileFormatOptions()
  const [type, setType] = useState(Object.keys(options)[0])
  const [helpText, setHelpText] = useState<string>()

  // Captured once rather than read live. The dialog is modal, so the user
  // cannot navigate under it, but the view's visible regions are derived from
  // its width — and a window resize behind the dialog would otherwise change
  // the fetch key and restart a long export from zero. Captured, they are also
  // what the Region field can name, so the label always describes the bytes.
  const view = getContainingView(model) as unknown as {
    visibleRegions?: Region[]
  }
  const [regions] = useState(() => roundRegions(view.visibleRegions ?? []))
  const regionStr = assembleLocStrings(regions)

  // set once the user has seen the estimate and asked for it anyway. In the
  // fetch key, so saying yes re-runs the fetch and then stays said for the rest
  // of the dialog, including a later format change.
  const [force, setForce] = useState(false)

  const {
    data: result,
    error,
    isLoading: loading,
    status,
  } = useFetch(
    regions.length && type
      ? ([
          'fetchTrackData',
          getConf(model, 'trackId'),
          regionStr,
          type,
          // a string, not the boolean: useFetch reads a `false` anywhere in an
          // array key as "don't fetch", so the gated state would fetch nothing
          force ? 'forced' : 'gated',
        ] as const)
      : null,
    async (
      _name,
      _trackId,
      _regions,
      fileType,
      mode,
      stopToken,
      statusCallback,
    ) =>
      fetchTrackData({
        model,
        regions,
        type: fileType,
        options,
        force: mode === 'forced',
        stopToken,
        statusCallback,
      }),
  )
  const tooLarge = result?.tooLarge
  const str = result?.str ?? ''
  const usedAdapterExport = result?.usedAdapterExport ?? false
  const format = type ? options[type] : undefined

  return (
    <InfoDialog
      maxWidth="xl"
      open
      onClose={handleClose}
      title="Save track data"
      actions={
        <>
          {tooLarge ? (
            <Button
              onClick={() => {
                setForce(true)
              }}
            >
              Download anyway
            </Button>
          ) : null}
          <CopyToClipboardButton
            disabled={loading || !!error || !!tooLarge}
            value={str}
            copiedLabel="Copied!"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </CopyToClipboardButton>
          <Button
            variant="contained"
            disabled={loading || !!error || !!tooLarge || !format}
            onClick={() => {
              if (format) {
                saveAs(
                  new Blob([str], { type: 'text/plain;charset=utf-8' }),
                  `jbrowse_track_data.${format.extension}`,
                )
              }
            }}
            startIcon={<GetAppIcon />}
          >
            Download
          </Button>
        </>
      }
    >
      <div className={classes.root}>
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
              ? statusProgressLabel(status) || 'Loading...'
              : tooLarge
                ? `${regionStr} is an estimated ${getDisplayStr(tooLarge.bytes)} on this track, over the ${getDisplayStr(tooLarge.limit)} this export asks about. Nothing has been downloaded — click "Download anyway" to fetch it.`
                : str.length > MAX_PREVIEW_CHARS
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
      </div>
      <InfoDialog
        open={helpText !== undefined}
        onClose={() => {
          setHelpText(undefined)
        }}
        title="Format Information"
      >
        <DialogContentText>{helpText}</DialogContentText>
      </InfoDialog>
    </InfoDialog>
  )
})

export default SaveTrackDataDialog
