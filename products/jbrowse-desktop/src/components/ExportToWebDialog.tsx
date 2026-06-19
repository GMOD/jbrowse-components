import { useState } from 'react'

import { Dialog, ErrorBanner } from '@jbrowse/core/ui'
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
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser'
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'
import type {
  HostedBaseConfig,
  WebExportPlan,
} from '@jbrowse/product-core'

async function buildExport(
  snapshot: Record<string, unknown>,
  shareURL: string,
  short: boolean,
) {
  const sourceConfigUrl = (
    snapshot.configuration as { sourceConfigUrl?: string } | undefined
  )?.sourceConfigUrl
  const baseConfig = sourceConfigUrl
    ? await fetchJson<HostedBaseConfig>(sourceConfigUrl)
    : undefined
  const plan = planWebExport(snapshot, baseConfig)

  if (short) {
    const { json, password } = await shareSessionToDynamo(
      plan.session,
      shareURL,
      DEFAULT_WEB_BASE_URL,
    )
    return {
      plan,
      url: buildWebExportUrl(plan, `share-${json.sessionId}`, { password }),
    }
  }
  const encoded = await toUrlSafeB64(JSON.stringify(plan.session))
  return { plan, url: buildWebExportUrl(plan, `encoded-${encoded}`) }
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
  const [short, setShort] = useState(true)
  const {
    data,
    error,
    isLoading: loading,
    mutate,
  } = useFetch(['exportToWeb', short], () =>
    buildExport(snapshot, shareURL, short),
  )
  const url = data?.url ?? ''
  const disabled = loading || !!error
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => { handleClose() }}
      title="Export session to web"
    >
      <DialogContent>
        <DialogContentText>
          Open this desktop session in jbrowse-web. Tracks that reference remote
          URLs work directly; local files do not.
        </DialogContentText>

        <RadioGroup
          row
          value={short ? 'short' : 'long'}
          onChange={event => {
            setShort(event.target.value === 'short')
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
          <Typography>Generating {short ? 'short' : 'long'} URL...</Typography>
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
            <TextField
              label="URL"
              value={url}
              variant="filled"
              fullWidth
              onClick={event => {
                ;(event.target as HTMLInputElement).select()
              }}
              slotProps={{ input: { readOnly: true } }}
            />
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
        <Button onClick={() => { handleClose() }} autoFocus>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ExportToWebDialog
