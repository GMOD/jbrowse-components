import { Typography, alpha } from '@mui/material'

import ExternalLink from './ExternalLink'
import { makeStyles } from '../util/tss-react'

// produce a source-map resolved stack trace
// reference code https://stackoverflow.com/a/77158517/2129219
const EMAIL = 'jbrowse2@berkeley.edu'

const useStyles = makeStyles()(theme => ({
  pre: {
    background: alpha(theme.palette.error.main, 0.2),
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    margin: 20,
    maxHeight: 300,
  },
}))

export default function ErrorMessageStackTraceContents({
  text,
  extra,
}: {
  text: string
  extra?: unknown
}) {
  const { classes } = useStyles()
  const extraStr = extra
    ? `supporting data: ${JSON.stringify(extra, null, 2)}`
    : ''
  const displayText = [text, extraStr].filter(Boolean).join('\n')
  const issueBody = encodeURIComponent(
    `I got this error from JBrowse, here is the stack trace:\n\n\`\`\`\n${text}\n\`\`\`\n${extraStr}\n`,
  )
  const githubLink = `https://github.com/GMOD/jbrowse-components/issues/new?labels=bug&title=JBrowse+issue&body=${issueBody}`
  const emailLink = `mailto:${EMAIL}?subject=JBrowse%202%20error&body=${issueBody}`

  return (
    <>
      <Typography>
        Post a new issue at{' '}
        <ExternalLink href={githubLink}>GitHub</ExternalLink> or send an email
        to <ExternalLink href={emailLink}>{EMAIL}</ExternalLink>
      </Typography>
      <pre className={classes.pre}>{displayText}</pre>
    </>
  )
}
