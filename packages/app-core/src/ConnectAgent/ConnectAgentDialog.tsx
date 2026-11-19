import { useState } from 'react'

import { InfoDialog, MonospaceTextField } from '@jbrowse/core/ui'
import copyToClipboard from '@jbrowse/core/util/copyToClipboard'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Alert,
  Button,
  DialogContentText,
  Link,
  Stack,
  Tab,
  Tabs,
} from '@mui/material'
import { observer } from 'mobx-react'

import { AGENT_DOCS_URL } from './agentRoutes.tsx'

import type { AgentRoute, AgentSnippet } from './agentRoutes.tsx'

const CopyableSnippet = observer(function CopyableSnippet({
  snippet,
}: {
  snippet: AgentSnippet
}) {
  const [status, setStatus] = useState<string>()
  return (
    <MonospaceTextField
      label={snippet.label}
      value={snippet.text}
      readOnly
      fullWidth
      multiline
      maxRows={10}
    >
      <Button
        size="small"
        startIcon={<ContentCopyIcon />}
        onClick={() => {
          copyToClipboard(snippet.text).then(
            () => {
              setStatus('Copied')
            },
            (e: unknown) => {
              setStatus(`Could not copy: ${e}`)
            },
          )
        }}
      >
        {status ?? 'Copy'}
      </Button>
    </MonospaceTextField>
  )
})

const ConnectAgentDialog = observer(function ConnectAgentDialog({
  routes,
  onClose,
}: {
  routes: AgentRoute[]
  onClose: () => void
}) {
  const [tab, setTab] = useState(0)
  const route = routes[tab]!
  return (
    <InfoDialog
      open
      maxWidth="sm"
      fullWidth
      title="Connect an AI agent"
      onClose={onClose}
    >
      <Stack spacing={2}>
        <Tabs
          value={tab}
          onChange={(_, value: number) => {
            setTab(value)
          }}
        >
          {routes.map(r => (
            <Tab key={r.label} label={r.label} />
          ))}
        </Tabs>
        {route.warning ? (
          <Alert severity="warning">{route.warning}</Alert>
        ) : null}
        <DialogContentText>{route.about}</DialogContentText>
        {route.snippets.map(s => (
          <CopyableSnippet key={`${route.label}-${s.label}`} snippet={s} />
        ))}
        <DialogContentText>
          The agent runs code: read what it asks to run, and do not point it at
          data you do not trust.{' '}
          <Link href={AGENT_DOCS_URL} target="_blank" rel="noopener noreferrer">
            Using JBrowse with AI agents
          </Link>
        </DialogContentText>
      </Stack>
    </InfoDialog>
  )
})

export default ConnectAgentDialog
