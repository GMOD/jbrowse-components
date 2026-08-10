import { useState } from 'react'

import {
  ErrorBanner,
  InfoDialog,
  LabeledCheckbox,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import ShareLinkField from '@jbrowse/core/ui/ShareLinkField'
import { copyTextWithSession } from '@jbrowse/core/util/copyText'
import { useFetch } from '@jbrowse/core/util/useFetch'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import {
  Alert,
  Button,
  DialogContentText,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ExportToWebInfoDialog from './ExportToWebInfoDialog.tsx'
import { buildLink, prepareExport } from './buildWebExport.ts'

import type { AbstractSessionModel, SessionShareMode } from '@jbrowse/core/util'
import type { WebExportInput, WebExportPlan } from '@jbrowse/product-core'

const SHARE_MODES = [
  // the default first, and in the order ExportToWebInfoDialog explains them
  { value: 'long', label: 'Long link' },
  { value: 'short', label: 'Short link' },
  { value: 'json', label: 'Plaintext JSON' },
] as const

function ShareModeRadios({
  mode,
  onChange,
}: {
  mode: SessionShareMode
  onChange: (mode: SessionShareMode) => void
}) {
  return (
    <RadioGroup
      row
      value={mode}
      onChange={event => {
        // MUI types the change value as a bare string; the radios below are the
        // only things that can produce one, so the narrowing is sound here
        onChange(event.target.value as SessionShareMode)
      }}
    >
      {SHARE_MODES.map(({ value, label }) => (
        <FormControlLabel
          key={value}
          value={value}
          control={<Radio />}
          label={label}
        />
      ))}
    </RadioGroup>
  )
}

// What the export decided and what it had to leave behind. Depends only on the
// plan, not on the share mode, so it stays on screen while a mode switch
// re-encodes the link.
function PlanSummary({ plan }: { plan: WebExportPlan }) {
  const { droppedTracks, blockingFiles } = plan
  return (
    <>
      {/* blocking files (a local assembly sequence, say) aren't attached to a
      droppable track; the session won't load on the web until they're hosted */}
      {blockingFiles.length ? (
        <Alert severity="error">
          This session references local files that jbrowse-web can&apos;t open,
          so it won&apos;t load correctly until they&apos;re hosted at a URL:{' '}
          {blockingFiles.join(', ')}.
        </Alert>
      ) : null}
      {droppedTracks.length ? (
        <Alert severity="warning">
          {droppedTracks.length} track{droppedTracks.length === 1 ? '' : 's'}{' '}
          left out of the export because{' '}
          {droppedTracks.length === 1 ? 'it references' : 'they reference'}{' '}
          local files: {droppedTracks.join(', ')}. Host these files at a URL to
          include them.
        </Alert>
      ) : null}
      <Typography variant="caption" color="textSecondary">
        {plan.strategy === 'hostedConfigBase'
          ? `Reuses the hosted config ${plan.configUrl}`
          : 'Self-contained session (carries its own assemblies and tracks)'}
      </Typography>
    </>
  )
}

// The plaintext-JSON mode's inspect panel. Owns its own expanded flag: it is
// unmounted whenever the mode produces no plaintext, so the flag resetting with
// it is the behavior we want.
function SessionJsonPanel({ plaintext }: { plaintext: string }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <LabeledCheckbox
        checked={show}
        onChange={val => {
          setShow(val)
        }}
        label="Show readable JSON"
      />
      {show ? (
        <MonospaceTextField
          label="Session JSON"
          value={plaintext}
          readOnly
          fullWidth
          maxRows={20}
        />
      ) : null}
    </>
  )
}

const ExportToWebDialog = observer(function ExportToWebDialog({
  handleClose,
  snapshot,
  session,
}: {
  handleClose: () => void
  snapshot: WebExportInput
  session: AbstractSessionModel
}) {
  // Default to 'long' — a fully local, inline link. 'short' uploads the (open)
  // session to the remote share store, so make that an explicit choice rather
  // than something merely opening this dialog does before the user acts.
  const [mode, setMode] = useState<SessionShareMode>('long')
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  // Two fetches rather than one keyed on the mode: switching modes must not
  // re-fetch the hosted base config, must not re-read the live session for the
  // bake at a different moment than the snapshot was taken, and must not blank
  // the portability warnings while it re-encodes.
  const prepared = useFetch(['exportToWebPlan'], () =>
    prepareExport(snapshot, session),
  )
  // A null fetcher until the plan resolves, which is also what starts the link
  // fetch once it does — and restarts it if a failed plan is retried, since
  // useFetch tracks the fetcher's nullness as a fetch input alongside the key.
  const preparation = prepared.data
  const link = useFetch(
    ['exportToWebLink', mode],
    preparation ? () => buildLink(preparation, mode) : null,
  )
  const plan = preparation?.plan
  const url = link.data?.url ?? ''
  const plaintext = link.data?.plaintext
  const error = prepared.error ?? link.error
  // Covers the plan fetch, the encode, and the render in between where neither
  // reports isLoading yet — anything that isn't a finished link or a failure.
  const generating = !error && !link.data
  const disabled = generating || !!error
  return (
    <>
      <InfoDialog
        maxWidth="xl"
        open
        onClose={() => {
          handleClose()
        }}
        title="Export session to web"
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<OpenInBrowserIcon />}
              disabled={disabled}
              onClick={() => {
                window.open(url, '_blank')
              }}
            >
              Open in browser
            </Button>
            <Button
              startIcon={<ContentCopyIcon />}
              disabled={disabled}
              onClick={() => {
                void copyTextWithSession(session, url, 'URL')
              }}
            >
              Copy to clipboard
            </Button>
          </>
        }
      >
        <DialogContentText>
          Open this desktop session in jbrowse-web.
          <IconButton
            onClick={() => {
              setInfoDialogOpen(true)
            }}
          >
            <HelpOutlineIcon />
          </IconButton>
        </DialogContentText>

        <ShareModeRadios mode={mode} onChange={setMode} />

        {error ? (
          <ErrorBanner
            error={error}
            onReset={() => {
              if (prepared.error) {
                prepared.mutate()
              } else {
                link.mutate()
              }
            }}
          />
        ) : (
          <>
            {plan ? <PlanSummary plan={plan} /> : null}
            {generating ? (
              <Typography>Generating {mode} URL...</Typography>
            ) : (
              <>
                <ShareLinkField value={url} />
                {plaintext ? <SessionJsonPanel plaintext={plaintext} /> : null}
              </>
            )}
          </>
        )}
      </InfoDialog>
      <ExportToWebInfoDialog
        open={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false)
        }}
      />
    </>
  )
})

export default ExportToWebDialog
