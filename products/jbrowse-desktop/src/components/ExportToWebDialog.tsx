import { useState } from 'react'

import { DEFAULT_SHARE_URL } from '@jbrowse/app-core'
import {
  ErrorBanner,
  InfoDialog,
  LabeledCheckbox,
  MonospaceTextField,
} from '@jbrowse/core/ui'
import ShareLinkField from '@jbrowse/core/ui/ShareLinkField'
import { encodeSessionParam, fetchJson } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { useFetch } from '@jbrowse/core/util/useFetch'
import {
  DEFAULT_WEB_BASE_URL,
  bakePromotedDefaultsIntoSnapshot,
  buildWebExportUrl,
  planWebExport,
} from '@jbrowse/product-core'
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

import type { AbstractSessionModel, SessionShareMode } from '@jbrowse/core/util'
import type {
  HostedBaseConfig,
  WebExportInput,
  WebExportPlan,
} from '@jbrowse/product-core'

async function buildExport(
  snapshot: WebExportInput,
  mode: SessionShareMode,
  session: AbstractSessionModel,
) {
  const sourceConfigUrl = snapshot.configuration?.sourceConfigUrl
  // If the hosted base config can't be fetched (hub down, offline), fall back
  // to a self-contained export rather than failing the whole operation —
  // planWebExport treats a missing baseConfig as "no usable base".
  const baseConfig = sourceConfigUrl
    ? await fetchJson<HostedBaseConfig>(sourceConfigUrl).catch((e: unknown) => {
        console.error(e)
        return undefined
      })
    : undefined
  if (baseConfig && sourceConfigUrl) {
    // Stamp baseUri onto the base's relative-URI locations the same way desktop
    // did when it first loaded this config (see fetchConfig), so planWebExport's
    // per-track diff against the base doesn't read every relative-URI location as
    // an edit.
    addRelativeUris(baseConfig, new URL(sourceConfigUrl))
  }
  const plan = planWebExport(snapshot, baseConfig)
  // Flatten the live promotable-default cascade into concrete track values, the
  // same as jbrowse-web's ShareDialog — a self-contained track is baked into its
  // sessionTracks config, a hosted-base track into a trackConfigDeltas entry the
  // web recipient merges — so the exported session shows what the sender saw.
  const bakedSession = bakePromotedDefaultsIntoSnapshot(session, plan.session)
  // A short link uploads to the share server that the export TARGET reads back
  // from — never this desktop instance's own shareURL config, since Desktop never
  // reads share links at all. That target is DEFAULT_WEB_BASE_URL loading
  // `?config=<plan.configUrl>`, and jbrowse-web resolves the store from *that
  // config's* configuration.shareURL (SessionLoader.fetchSharedSession). So a
  // hosted base declaring its own share server has to win here, or the link
  // resolves against a store the session was never uploaded to. With no hosted
  // base (self-contained, `?config=none`) web falls back to DEFAULT_SHARE_URL, and
  // the two defaults are a pair.
  const { sessionParam, password, plaintext } = await encodeSessionParam(
    mode,
    bakedSession,
    {
      shareURL:
        plan.strategy === 'hostedConfigBase'
          ? // mirrors web's readConf: an explicit empty string is honored as-is
            (baseConfig?.configuration?.shareURL ?? DEFAULT_SHARE_URL)
          : DEFAULT_SHARE_URL,
      referer: DEFAULT_WEB_BASE_URL,
    },
  )
  return {
    plan,
    url: buildWebExportUrl(plan, sessionParam, { password }),
    plaintext,
  }
}

function PortabilityWarning({ plan }: { plan: WebExportPlan }) {
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
  const [showReadableJson, setShowReadableJson] = useState(false)
  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(['exportToWeb', mode], () =>
    buildExport(snapshot, mode, session),
  )
  const url = data?.url ?? ''
  const plaintext = data?.plaintext
  const disabled = loading || !!error
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
              onClick={async () => {
                const { default: copy } =
                  await import('@jbrowse/core/util/copyToClipboard')
                if (copy(url)) {
                  session.notify('Copied to clipboard', 'success')
                }
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

        <RadioGroup
          row
          value={mode}
          onChange={event => {
            setMode(event.target.value as SessionShareMode)
          }}
        >
          <FormControlLabel
            value="short"
            control={<Radio />}
            label="Short link"
          />
          <FormControlLabel
            value="long"
            control={<Radio />}
            label="Long link"
          />
          <FormControlLabel
            value="json"
            control={<Radio />}
            label="Plaintext JSON"
          />
        </RadioGroup>

        {error ? (
          <ErrorBanner
            error={error}
            onReset={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              mutate()
            }}
          />
        ) : loading ? (
          <Typography>Generating {mode} URL...</Typography>
        ) : (
          <>
            {data ? <PortabilityWarning plan={data.plan} /> : null}
            {data?.plan.strategy === 'hostedConfigBase' ? (
              <Typography variant="caption" color="textSecondary">
                Reuses the hosted config {data.plan.configUrl}
              </Typography>
            ) : (
              <Typography variant="caption" color="textSecondary">
                Self-contained session (carries its own assemblies and tracks)
              </Typography>
            )}
            <ShareLinkField value={url} />
            {plaintext ? (
              <LabeledCheckbox
                checked={showReadableJson}
                onChange={val => {
                  setShowReadableJson(val)
                }}
                label="Show readable JSON"
              />
            ) : null}
            {plaintext && showReadableJson ? (
              <MonospaceTextField
                label="Session JSON"
                value={plaintext}
                readOnly
                fullWidth
                maxRows={20}
              />
            ) : null}
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
