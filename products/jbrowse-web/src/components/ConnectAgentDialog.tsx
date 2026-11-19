import { InfoDialog, MonospaceTextField } from '@jbrowse/core/ui'
import { copyTextWithSession } from '@jbrowse/core/util/copyText'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { Button, DialogContentText, Link } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel } from '@jbrowse/core/util'

export const STARTER_PROMPT =
  'This tab is JBrowse Web. Drive it through window.jb: read jb.help first, then orient with jb.sessionSummary(). My goal: '

const DOCS_URL =
  'https://jbrowse.org/jb2/docs/agents/#claude-in-chrome-with-jbrowse-web'

const ConnectAgentDialog = observer(function ConnectAgentDialog({
  session,
  onClose,
}: {
  session: Pick<AbstractSessionModel, 'notify' | 'notifyError'>
  onClose: () => void
}) {
  return (
    <InfoDialog
      open
      maxWidth="sm"
      title="Connect an AI agent"
      onClose={onClose}
      actions={
        <Button
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            void copyTextWithSession(session, STARTER_PROMPT, 'starter prompt')
          }}
        >
          Copy starter prompt
        </Button>
      }
    >
      <DialogContentText>
        Open this page in Chrome and open the Claude in Chrome side panel. There
        is nothing to install: the page publishes <code>window.jb</code>, and
        the agent builds views, adds tracks, reads feature data and checks what
        drew through it.
      </DialogContentText>
      <MonospaceTextField
        label="Starter prompt"
        value={STARTER_PROMPT}
        readOnly
        fullWidth
      />
      <DialogContentText>
        Every step the agent takes is JavaScript run in this page, so read what
        it asks to run and do not point it at data you do not trust. A browser
        cannot read local files, so a file the agent adds has to be a URL this
        page can fetch.
      </DialogContentText>
      <DialogContentText>
        <Link href={DOCS_URL} target="_blank" rel="noopener noreferrer">
          Using JBrowse with AI agents
        </Link>
      </DialogContentText>
    </InfoDialog>
  )
})

export default ConnectAgentDialog
