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
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
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

// Which base the export settled on. The three self-contained cases produce the
// same session and want different words: a hub that was never involved is the
// ordinary case, a hub that could not be fetched is a link worth building again
// on a working connection, since self-contained is also the biggest kind of
// session and the one that outgrows what a URL can carry.
function BaseSummary({
  plan,
  sourceConfigUrl,
}: {
  plan: WebExportPlan
  sourceConfigUrl?: string
}) {
  if (plan.strategy === 'hostedConfigBase') {
    return (
      <Typography variant="caption" color="textSecondary">
        Reuses the hosted config {plan.configUrl}
      </Typography>
    )
  }
  return plan.selfContainedReason === 'baseUnreachable' ? (
    <Alert severity="warning">
      Couldn&apos;t fetch the hosted config this session was opened from
      {sourceConfigUrl ? ` (${sourceConfigUrl})` : ''}, so the session carries
      its own assemblies and tracks and the link is much larger than it would
      otherwise be. Export again once that config is reachable to get the small
      one.
    </Alert>
  ) : (
    <Typography variant="caption" color="textSecondary">
      {plan.selfContainedReason === 'assembliesNotInBase'
        ? 'Self-contained session: the hosted config no longer provides every assembly this session uses'
        : 'Self-contained session (carries its own assemblies and tracks)'}
    </Typography>
  )
}

// What the export decided and what it had to leave behind. Depends only on the
// plan, not on the share mode, so it stays on screen while a mode switch
// re-encodes the link.
function PlanSummary({
  plan,
  sourceConfigUrl,
}: {
  plan: WebExportPlan
  sourceConfigUrl?: string
}) {
  const {
    droppedTracks,
    blockingFiles,
    droppedTextIndexes,
    revertedAssemblies,
    unavailableAccounts,
  } = plan
  return (
    <>
      {/* blocking files (a local assembly sequence, say) aren't attached to a
      droppable track; the session won't load on the web until they're hosted */}
      {blockingFiles.length ? (
        <Alert severity="error">
          This session references local files that jbrowse-web can&apos;t open,
          so it won&apos;t load correctly until they&apos;re hosted at a URL:{' '}
          {blockingFiles.join(', ')}. Their paths stay in the exported session,
          so they travel inside the link — and, for a short link, to the share
          server with it.
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
      {droppedTextIndexes.length ? (
        <Alert severity="info">
          The text-search index built on this computer stays behind for{' '}
          {droppedTextIndexes.join(', ')}. The track itself is exported; only
          its search box is gone.
        </Alert>
      ) : null}
      {revertedAssemblies.length ? (
        <Alert severity="warning">
          The recipient takes {revertedAssemblies.join(', ')} from the hosted
          config, so any change you made to{' '}
          {revertedAssemblies.length === 1 ? 'it' : 'them'} — an alias or
          cytoband file, say — is not part of this export.
        </Alert>
      ) : null}
      {unavailableAccounts.length ? (
        <Alert severity="warning">
          Files in this session authenticate through{' '}
          {unavailableAccounts.join(', ')}, which the recipient&apos;s JBrowse
          won&apos;t have. Those files are requested without credentials and
          will fail if they are not public.
        </Alert>
      ) : null}
      <BaseSummary plan={plan} sourceConfigUrl={sourceConfigUrl} />
    </>
  )
}

// The host a short link's session gets uploaded to, for the prompt below.
// Undefined when the configured shareURL isn't an absolute url — jbrowse-web
// honors an empty one as "relative to the page", which names no host to show.
function shareHost(shareURL: string) {
  try {
    return new URL(shareURL).host
  } catch {
    return undefined
  }
}

// The short link is the one thing this dialog does that leaves the computer, so
// it is a button rather than something selecting a radio does on the user's
// behalf. The rule is worth being able to state in one sentence: an upload
// happens when you press this, and at no other time. That is also why switching
// modes and coming back asks again instead of quietly reusing or re-sending —
// see the reset in the dialog's mode handler.
function ShortLinkPrompt({
  shareURL,
  onUpload,
}: {
  shareURL: string
  onUpload: () => void
}) {
  const host = shareHost(shareURL)
  return (
    <>
      {/* The decryption key rides in the link's query string, which the page it
      points at does receive — so "the server never sees it" is only true of the
      share server, and saying it plainly is the difference between a claim
      someone can rely on and one they can't. */}
      <Alert severity="info">
        This encrypts your session in this app and uploads it to{' '}
        {host ?? 'the share server'}, which hands it back to whoever opens the
        link. {host ?? 'The share server'} never receives the decryption key,
        but it does travel in the link, so treat the link itself as the secret.
        Nothing is uploaded until you press the button below.
      </Alert>
      <Button
        variant="contained"
        startIcon={<CloudUploadIcon />}
        onClick={onUpload}
      >
        Upload and create short link
      </Button>
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
  // Default to 'long' — a fully local, inline link, and the one mode that has a
  // usable answer the moment the dialog opens. Selecting 'short' still sends
  // nothing on its own; see ShortLinkPrompt.
  const [mode, setMode] = useState<SessionShareMode>('long')
  const [uploadRequested, setUploadRequested] = useState(false)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  // Two fetches rather than one keyed on the mode: switching modes must not
  // re-fetch the hosted base config, must not re-read the live session for the
  // bake at a different moment than the snapshot was taken, and must not blank
  // the portability warnings while it re-encodes.
  const prepared = useFetch(['exportToWebPlan'], () =>
    prepareExport(snapshot, session),
  )
  // The short mode is the only one that leaves this computer, so it waits for
  // the user to ask; the inline modes assemble locally and need no permission.
  const awaitingUpload = mode === 'short' && !uploadRequested
  // A null fetcher until the plan resolves and (for short) the upload is asked
  // for. That nullness is also what starts the link fetch when either arrives —
  // and what restarts it if a failed plan is retried — since useFetch tracks it
  // as a fetch input alongside the key.
  const preparation = prepared.data
  const link = useFetch(
    ['exportToWebLink', mode],
    preparation && !awaitingUpload ? () => buildLink(preparation, mode) : null,
  )
  const plan = preparation?.plan
  const url = link.data?.url ?? ''
  const plaintext = link.data?.plaintext
  const error = prepared.error ?? link.error
  // Only once there is a plan: until then the dialog is still working, and has
  // no share store to name in the prompt.
  const promptForUpload = preparation && awaitingUpload
  // Covers the plan fetch, the encode, and the render in between where neither
  // reports isLoading yet — anything that isn't a finished link, a failure, or
  // a short link nobody has asked for.
  const generating = !error && !promptForUpload && !link.data
  const disabled = !link.data || !!error
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

        <ShareModeRadios
          mode={mode}
          onChange={m => {
            setMode(m)
            // Leaving short mode withdraws the permission to upload, so coming
            // back asks again rather than re-sending on arrival.
            setUploadRequested(false)
          }}
        />

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
            {plan ? (
              <PlanSummary
                plan={plan}
                sourceConfigUrl={snapshot.configuration?.sourceConfigUrl}
              />
            ) : null}
            {promptForUpload ? (
              <ShortLinkPrompt
                shareURL={preparation.shareURL}
                onUpload={() => {
                  setUploadRequested(true)
                }}
              />
            ) : generating ? (
              <Typography>Generating {mode} URL...</Typography>
            ) : (
              <>
                <ShareLinkField
                  value={url}
                  // An export is the biggest kind of session — a self-contained
                  // one carries its own assemblies and tracks — so the mode
                  // that solves an unopenable link is one click away, in the
                  // same state selecting the radio would leave: asked for, not
                  // yet uploaded.
                  action={
                    mode === 'short' ? undefined : (
                      <Button
                        onClick={() => {
                          setMode('short')
                          setUploadRequested(false)
                        }}
                      >
                        Use a short link
                      </Button>
                    )
                  }
                />
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
