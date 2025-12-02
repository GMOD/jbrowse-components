import { useEffect, useState } from 'react'

import { isElectron } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  Typography,
  alpha,
} from '@mui/material'
import { LocalFile } from 'generic-filehandle2'
import { SourceMapConsumer } from 'source-map-js'

import Dialog from './Dialog'
import ExternalLink from './ExternalLink'
import LoadingEllipses from './LoadingEllipses'

async function myfetchtext(uri: string) {
  if (uri.startsWith('file://') && isElectron) {
    const localPath = decodeURIComponent(new URL(uri).pathname)
    const file = new LocalFile(localPath)
    const buffer = await file.readFile()
    return new TextDecoder().decode(buffer)
  }
  const res = await fetch(uri)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${uri}: ${await res.text()}`)
  }
  return res.text()
}

async function myfetchjson(uri: string) {
  const text = await myfetchtext(uri)
  return JSON.parse(text)
}

// produce a source-map resolved stack trace
// reference code https://stackoverflow.com/a/77158517/2129219
const sourceMaps: Record<string, SourceMapConsumer> = {}
async function getSourceMapFromUri(uri: string) {
  if (sourceMaps[uri] !== undefined) {
    return sourceMaps[uri]
  }
  const uriQuery = new URL(uri).search
  const currentScriptContent = await myfetchtext(uri)

  let mapUri =
    new RegExp(/\/\/# sourceMappingURL=(.*)/).exec(currentScriptContent)?.[1] ||
    ''
  mapUri = new URL(mapUri, uri).href + uriQuery

  const data = await myfetchjson(mapUri)
  const map = new SourceMapConsumer(data)
  sourceMaps[uri] = map
  return map
}

async function mapStackTrace(stack: string) {
  const stackLines = stack.split('\n')
  const mappedStack = []

  for (const line of stackLines) {
    const match = new RegExp(/(.*)((?:https?|file):\/\/.*):(\d+):(\d+)/).exec(
      line,
    )
    if (match === null) {
      mappedStack.push(line)
      continue
    }

    const uri = match[2]!
    const consumer = await getSourceMapFromUri(uri)

    const originalPosition = consumer.originalPositionFor({
      line: Number.parseInt(match[3]!),
      column: Number.parseInt(match[4]!),
    })

    if (
      !originalPosition.source ||
      !originalPosition.line ||
      !originalPosition.column
    ) {
      mappedStack.push(line)
      continue
    }

    mappedStack.push(
      `${originalPosition.source}:${originalPosition.line}:${
        originalPosition.column + 1
      } (${match[1]!.trim()})`,
    )
  }

  return mappedStack.join('\n')
}

const MAX_ERR_LEN = 10_000

// Chrome has the error message in the stacktrace, firefox doesn't
function stripMessage(trace: string, error: unknown) {
  if (trace.startsWith('Error:')) {
    // remove the error message, which can be very long due to @jbrowse/mobx-state-tree
    // stuff, to get just the stack trace
    const err = `${error}`
    return trace.slice(err.length)
  } else {
    return trace
  }
}

const useStyles = makeStyles()(theme => ({
  pre: {
    background: alpha(theme.palette.error.main, 0.2),
    border: `1px solid ${theme.palette.divider}`,
    overflow: 'auto',
    margin: 20,
    maxHeight: 300,
  },
}))

function Contents({ text, extra }: { text: string; extra?: unknown }) {
  const { classes } = useStyles()
  const err = encodeURIComponent(
    `${[
      'I got this error from JBrowse, here is the stack trace:\n',
      '```',
      text,
      '```',
      extra ? `supporting data: ${JSON.stringify(extra, null, 2)}` : '',
    ].join('\n')}\n`,
  )

  const err2 = [
    text,
    extra ? `supporting data: ${JSON.stringify(extra, null, 2)}` : '',
  ].join('\n')

  const email = 'jbrowse2@berkeley.edu'
  const githubLink = `https://github.com/GMOD/jbrowse-components/issues/new?labels=bug&title=JBrowse+issue&body=${err}`
  const emailLink = `mailto:${email}?subject=JBrowse%202%20error&body=${err}`

  return (
    <>
      <Typography>
        Post a new issue at{' '}
        <ExternalLink href={githubLink}>GitHub</ExternalLink> or send an email
        to <ExternalLink href={emailLink}>{email}</ExternalLink>{' '}
      </Typography>
      <pre className={classes.pre}>{err2}</pre>
    </>
  )
}

export default function ErrorMessageStackTraceDialog({
  error,
  onClose,
  extra,
}: {
  onClose: () => void
  error: unknown
  extra?: unknown
}) {
  const [mappedStackTrace, setMappedStackTrace] = useState<string>()
  const [secondaryError, setSecondaryError] = useState<unknown>()
  const [clicked, setClicked] = useState(false)
  const stackTracePreProcessed = `${typeof error === 'object' && error !== null && 'stack' in error ? error.stack : ''}`
  const errorText = error ? `${error}` : ''
  const stackTrace = stripMessage(stackTracePreProcessed, errorText)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const res = await mapStackTrace(stackTrace)
        setMappedStackTrace(res)
      } catch (e) {
        console.error(e)
        setMappedStackTrace(stackTrace)
        setSecondaryError(e)
      }
    })()
  }, [stackTrace])

  const errorBoxText = [
    secondaryError
      ? 'Error loading source map, showing raw stack trace below:'
      : '',
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || 'No stack trace available',
    // @ts-expect-error add version info at bottom if we are in jbrowse-web
    window.JBrowseSession ? `JBrowse ${window.JBrowseSession.version}` : '',
  ]
    .filter(f => !!f)
    .join('\n')

  return (
    <Dialog open onClose={onClose} title="Stack trace" maxWidth="xl">
      <DialogContent>
        {mappedStackTrace === undefined ? (
          <LoadingEllipses variant="h6" />
        ) : (
          <Contents text={errorBoxText} extra={extra} />
        )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={async () => {
            const { default: copy } = await import('copy-to-clipboard')
            copy(errorBoxText)
            setClicked(true)
            setTimeout(() => {
              setClicked(false)
            }, 1000)
          }}
        >
          {clicked ? 'Copied!' : 'Copy stack trace to clipboard'}
        </Button>
        <Button variant="contained" color="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
