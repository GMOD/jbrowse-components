import { useState } from 'react'

import { InfoDialog, MonospaceTextField } from '@jbrowse/core/ui'
import { copyTextWithSession } from '@jbrowse/core/util/copyText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import {
  Button,
  DialogContentText,
  Link,
  Stack,
  Tab,
  Tabs,
} from '@mui/material'
import { observer } from 'mobx-react'

import packageJSON from '../../package.json' with { type: 'json' }

import type { AbstractSessionModel } from '@jbrowse/core/util'

const { version } = packageJSON

export const SKILLS_URL =
  'https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills'

const DOCS_URL = 'https://jbrowse.org/jb2/docs/agents/'

export const routes = [
  {
    label: 'In this page',
    prompt:
      'This tab is JBrowse Web. Drive it through window.jb: read jb.help first, then orient with jb.sessionSummary(). My goal: ',
    about: (
      <>
        An agent that can run JavaScript in this tab drives it through{' '}
        <code>window.jb</code>: it builds views, adds tracks, reads feature data
        and checks what drew. That can be a browser extension such as{' '}
        <Link
          href="https://claude.com/chrome"
          target="_blank"
          rel="noopener noreferrer"
        >
          Claude in Chrome
        </Link>
        , or a coding agent connected to Chrome through{' '}
        <Link
          href="https://github.com/ChromeDevTools/chrome-devtools-mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Chrome DevTools MCP
        </Link>{' '}
        or{' '}
        <Link
          href="https://github.com/microsoft/playwright-mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Playwright MCP
        </Link>
        . Files it adds have to be URLs this page can fetch.
      </>
    ),
  },
  {
    label: 'Command line',
    prompt: `Follow the jbrowse-authoring, jbrowse-hosted-data and jbrowse-capture skills at ${SKILLS_URL}. From the command line, build the view (name a hosted genome with --genome, or write a config for your own data and check it with npx @jbrowse/cli@${version} validate), render it with npx @jbrowse/img@${version} or npx @jbrowse/capture@${version}, and look at the image to confirm every track drew. My goal: `,
    about: (
      <>
        An agent with a shell, such as Claude Code, Codex CLI or Gemini CLI,
        needs no browser open. It opens a hosted genome or writes a config for
        your data, renders it to an image with <code>@jbrowse/img</code>, or
        with <code>@jbrowse/capture</code> when it needs the full app, and reads
        the image back to check its work. The prompt points it at the{' '}
        <Link href={SKILLS_URL} target="_blank" rel="noopener noreferrer">
          JBrowse agent skills
        </Link>
        .
      </>
    ),
  },
]

const ConnectAgentDialog = observer(function ConnectAgentDialog({
  session,
  onClose,
}: {
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>
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
      actions={
        <Button
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void copyTextWithSession(session, route.prompt, 'prompt')
          }}
        >
          Copy prompt
        </Button>
      }
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
        <DialogContentText>{route.about}</DialogContentText>
        <MonospaceTextField
          value={route.prompt}
          readOnly
          fullWidth
          multiline
          maxRows={10}
        />
        <DialogContentText>
          Paste the prompt into the agent and finish its last line with your
          goal. The agent runs code: read what it asks to run, and do not point
          it at data you do not trust.{' '}
          <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            Using JBrowse with AI agents
          </Link>
        </DialogContentText>
      </Stack>
    </InfoDialog>
  )
})

export default ConnectAgentDialog
