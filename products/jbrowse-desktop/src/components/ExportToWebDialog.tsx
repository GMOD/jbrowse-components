import { useState } from 'react'

import { Dialog, ErrorBanner, MonospaceTextField } from '@jbrowse/core/ui'
import ShareLinkField from '@jbrowse/core/ui/ShareLinkField'
import {
  fetchJson,
  shareSessionToDynamo,
  toUrlSafeB64,
  useFetch,
} from '@jbrowse/core/util'
import {
  DEFAULT_WEB_BASE_URL,
  buildWebExportUrl,
  planWebExport,
} from '@jbrowse/product-core'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined'
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import {
  Alert,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ExportToWebInfoDialog from './ExportToWebInfoDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { HostedBaseConfig, WebExportPlan } from '@jbrowse/product-core'

type ExportMode = 'short' | 'long' | 'json'

async function buildExport(
  snapshot: Record<string, unknown>,
  shareURL: string,
  mode: ExportMode,
) {
  const sourceConfigUrl = (
    snapshot.configuration as { sourceConfigUrl?: string } | undefined
  )?.sourceConfigUrl
  const baseConfig = sourceConfigUrl
    ? await fetchJson<HostedBaseConfig>(sourceConfigUrl)
    : undefined
  const plan = planWebExport(snapshot, baseConfig)

  if (mode === 'short') {
    const { json, password } = await shareSessionToDynamo(
      plan.session,
      shareURL,
      DEFAULT_WEB_BASE_URL,
    )
    return {
      plan,
      url: buildWebExportUrl(plan, `share-${json.sessionId}`, { password }),
    }
  } else if (mode === 'json') {
    // readable, uncompressed session embedded directly in the URL so users can
    // inspect exactly what gets opened on the web
    const sessionParam = `json-${JSON.stringify({ session: plan.session })}`
    return {
      plan,
      url: buildWebExportUrl(plan, sessionParam),
      plaintext: JSON.stringify({ session: plan.session }, null, 2),
    }
  } else {
    const encoded = await toUrlSafeB64(JSON.stringify(plan.session))
    return { plan, url: buildWebExportUrl(plan, `encoded-${encoded}`) }
  }
}

function PortabilityWarning({ plan }: { plan: WebExportPlan }) {
  const { nonPortable } = plan.report
  return nonPortable.length ? (
    <Alert severity="warning">
      {nonPortable.length} local file
      {nonPortable.length === 1 ? '' : 's'} cannot be opened on the web and will
      not load:{' '}
      {[...new Set(nonPortable.map(l => l.trackName ?? l.name))].join(', ')}.
      Host these files at a URL to include them.
    </Alert>
  ) : null
}

const ExportToWebDialog = observer(function ExportToWebDialog({
  handleClose,
  snapshot,
  shareURL,
  session,
}: {
  handleClose: () => void
  snapshot: Record<string, unknown>
  shareURL: string
  session: AbstractSessionModel
}) {
  const [mode, setMode] = useState<ExportMode>('short')
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [showReadableJson, setShowReadableJson] = useState(false)
  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(['exportToWeb', mode], () =>
    buildExport(snapshot, shareURL, mode),
  )
  const url = data?.url ?? ''
  const plaintext = data?.plaintext
  const disabled = loading || !!error
  return (
    <>
      <Dialog
        maxWidth="xl"
        open
        onClose={() => {
          handleClose()
        }}
        title="Export session to web"
      >
        <DialogContent>
          <DialogContentText>
            Open this desktop session in jbrowse-web. Tracks that reference
            remote URLs work directly; local files do not.
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
              setMode(event.target.value as ExportMode)
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
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showReadableJson}
                      onChange={event => {
                        setShowReadableJson(event.target.checked)
                      }}
                    />
                  }
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
        </DialogContent>
        <DialogActions>
          <Button
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
          <Button
            onClick={() => {
              handleClose()
            }}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
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
