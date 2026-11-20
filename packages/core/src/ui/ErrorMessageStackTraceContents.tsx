import { useState } from 'react'

import { Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import ControlRow from './ControlRow.tsx'
import ExternalLink from './ExternalLink.tsx'
import { ERROR_REPORT_EMAIL, sendErrorReport } from './errorReport.ts'
import { alpha } from './palette.ts'

const useStyles = makeStyles()(theme => ({
  pre: {
    background: alpha(theme.palette.error.main, 0.2),
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    margin: 0,
    maxHeight: 300,
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginBlock: theme.spacing(1),
  },
  email: {
    flexGrow: 1,
    maxWidth: 360,
  },
}))

type SendState = 'idle' | 'sending' | 'sent' | 'failed'

const ErrorMessageStackTraceContents = observer(
  function ErrorMessageStackTraceContents({
    text,
    extra,
  }: {
    text: string
    extra?: unknown
  }) {
    const { classes } = useStyles()
    const [comment, setComment] = useState('')
    const [email, setEmail] = useState('')
    const [sendState, setSendState] = useState<SendState>('idle')
    const extraStr = extra
      ? `supporting data: ${JSON.stringify(extra, null, 2)}`
      : ''
    const displayText = [text, extraStr].filter(Boolean).join('\n')
    const issueBody = encodeURIComponent(
      `I got this error from JBrowse, here is the stack trace:\n\n\`\`\`\n${text}\n\`\`\`\n${extraStr}\n`,
    )
    const githubLink = `https://github.com/GMOD/jbrowse-components/issues/new?labels=bug&title=JBrowse+issue&body=${issueBody}`
    const emailLink = `mailto:${ERROR_REPORT_EMAIL}?subject=JBrowse%202%20error&body=${issueBody}`
    const emailAddressLink = (
      <ExternalLink href={emailLink}>{ERROR_REPORT_EMAIL}</ExternalLink>
    )

    return (
      <div className={classes.stack}>
        <pre className={classes.pre}>{displayText}</pre>
        <TextField
          label="What were you doing when this happened? (optional)"
          multiline
          minRows={2}
          value={comment}
          onChange={event => {
            setComment(event.target.value)
          }}
        />
        <ControlRow>
          <TextField
            className={classes.email}
            label="Your email, for a reply (optional)"
            type="email"
            value={email}
            onChange={event => {
              setEmail(event.target.value)
            }}
          />
          <Button
            variant="contained"
            color="primary"
            disabled={sendState === 'sending' || sendState === 'sent'}
            onClick={async () => {
              setSendState('sending')
              try {
                await sendErrorReport({ report: displayText, comment, email })
                setSendState('sent')
              } catch (e) {
                console.error(e)
                setSendState('failed')
              }
            }}
          >
            {sendState === 'sending'
              ? 'Sending...'
              : sendState === 'sent'
                ? 'Sent'
                : 'Send report'}
          </Button>
        </ControlRow>
        {sendState === 'sent' ? (
          <Typography>Thank you. The JBrowse team has your report.</Typography>
        ) : sendState === 'failed' ? (
          <Typography color="error">
            The report could not be sent. Please email it to {emailAddressLink}{' '}
            instead.
          </Typography>
        ) : (
          <Typography variant="body2">
            Send report mails this to the JBrowse team at {emailAddressLink}.
            You can also email it yourself, or post it as an issue on{' '}
            <ExternalLink href={githubLink}>GitHub</ExternalLink>.
          </Typography>
        )}
      </div>
    )
  },
)

export default ErrorMessageStackTraceContents
