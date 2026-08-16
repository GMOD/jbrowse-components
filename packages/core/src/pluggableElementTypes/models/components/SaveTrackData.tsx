import { useRef, useState } from 'react'

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
  saveAs,
  statusProgressLabel,
} from '../../../util/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import { useFetch } from '../../../util/useFetch.ts'
import {
  fetchTrackData,
  roundRegions,
  trackSupportsAdapterExport,
} from './fetchTrackData.ts'

import type { AnyConfigurationModel } from '../../../configuration/index.ts'
import type { Feature, Region } from '../../../util/index.ts'
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

function HelpDialog({
  text,
  onClose,
}: {
  text: string | undefined
  onClose: () => void
}) {
  return (
    <InfoDialog
      open={text !== undefined}
      onClose={onClose}
      title="Format Information"
    >
      <DialogContentText>{text}</DialogContentText>
    </InfoDialog>
  )
}

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

  // Answerable without the fetch, so the legend says which kind of export this
  // is while it runs instead of flipping when it lands. `usedAdapterExport`
  // still overrides it once known: an adapter that exports some formats and not
  // others declines the rest, and the fetch falls back to features.
  const supportsExport = trackSupportsAdapterExport(model)

  // Features for one set of regions, kept across a format change: every writer
  // on that path reads the same features, so switching GFF3 -> BED reruns the
  // writer rather than the region read, which on a deep track is the same work
  // the display does.
  const featureCache = useRef<Feature[] | undefined>(undefined)

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
        ] as const)
      : null,
    async (_name, _trackId, _regions, fileType, stopToken, statusCallback) => {
      const res = await fetchTrackData({
        model,
        regions,
        type: fileType,
        options,
        features: featureCache.current,
        stopToken,
        statusCallback,
      })
      // an adapter-exported format hands back no features, and that is not a
      // reason to drop the ones an earlier format read: `regions` is captured
      // for the dialog's lifetime, so they still describe this export
      featureCache.current = res.features ?? featureCache.current
      return res
    },
  )
  const str = result?.str ?? ''
  const usedAdapterExport = result?.usedAdapterExport ?? supportsExport
  const format = type ? options[type] : undefined

  return (
    <InfoDialog
      maxWidth="xl"
      open
      onClose={handleClose}
      title="Save track data"
      actions={
        <>
          <CopyToClipboardButton
            disabled={loading || !!error}
            value={str}
            copiedLabel="Copied!"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </CopyToClipboardButton>
          <Button
            variant="contained"
            disabled={loading || !!error || !format}
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
      <HelpDialog
        text={helpText}
        onClose={() => {
          setHelpText(undefined)
        }}
      />
    </InfoDialog>
  )
})

export default SaveTrackDataDialog
