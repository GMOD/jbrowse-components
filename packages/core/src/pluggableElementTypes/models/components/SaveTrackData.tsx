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

import type { Region } from '../../../util/index.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { ExportableTrack } from './fetchTrackData.ts'

const MAX_PREVIEW_CHARS = 500_000
const TOO_BIG_TO_PREVIEW =
  'File greater than 500kb, too large to view here. Click "Download" to save results to file'

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

/**
 * The export in the selected format, and the confirmation the size gate needs.
 * `force` lives here rather than in the component because it is a fetch input:
 * saying yes has to re-run the fetch, and then stay said for the rest of the
 * dialog, including a later format change.
 */
function useTrackDataExport({
  model,
  regions,
  regionStr,
  type,
  options,
}: {
  model: ExportableTrack
  regions: Region[]
  regionStr: string
  type: string
  options: Record<string, FileTypeExporter>
}) {
  const [force, setForce] = useState(false)
  const { data, error, isLoading, status } = useFetch(
    regions.length
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
  return { result: data, error, loading: isLoading, status, setForce }
}

/**
 * The format picker, owning the per-format help text and the dialog that shows
 * it — nothing above needs to know a format can carry one.
 */
function FormatSelector({
  options,
  type,
  setType,
  usedAdapterExport,
}: {
  options: Record<string, FileTypeExporter>
  type: string
  setType: (arg: string) => void
  usedAdapterExport: boolean
}) {
  const { classes } = useStyles()
  const [helpText, setHelpText] = useState<string>()
  return (
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
      <InfoDialog
        open={helpText !== undefined}
        onClose={() => {
          setHelpText(undefined)
        }}
        title="Format Information"
      >
        <DialogContentText>{helpText}</DialogContentText>
      </InfoDialog>
    </FormControl>
  )
}

const SaveTrackDataDialog = observer(function SaveTrackDataDialog({
  model,
  handleClose,
}: {
  model: ExportableTrack
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const options = model.saveTrackFileFormatOptions()
  // every track type declaring this view declares at least one format
  const [type, setType] = useState(Object.keys(options)[0]!)

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

  const { result, error, loading, status, setForce } = useTrackDataExport({
    model,
    regions,
    regionStr,
    type,
    options,
  })
  const tooLarge = result?.tooLarge
  const str = result?.str ?? ''
  const noResult = loading || !!error || !!tooLarge

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
            disabled={noResult}
            value={str}
            copiedLabel="Copied!"
            startIcon={<ContentCopyIcon />}
          >
            Copy to clipboard
          </CopyToClipboardButton>
          <Button
            variant="contained"
            disabled={noResult}
            onClick={() => {
              saveAs(
                new Blob([str], { type: 'text/plain;charset=utf-8' }),
                `jbrowse_track_data.${options[type]!.extension}`,
              )
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
        <FormatSelector
          options={options}
          type={type}
          setType={setType}
          usedAdapterExport={!!result?.usedAdapterExport}
        />
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
                  ? TOO_BIG_TO_PREVIEW
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
    </InfoDialog>
  )
})

export default SaveTrackDataDialog
