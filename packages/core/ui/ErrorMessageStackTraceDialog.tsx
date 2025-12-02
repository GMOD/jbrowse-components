import { useEffect, useState } from 'react'

import { Button, DialogActions, DialogContent } from '@mui/material'
import { SourceMapConsumer } from 'source-map-js'

import Dialog from './Dialog'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents'
import LoadingEllipses from './LoadingEllipses'

async function myfetchtext(uri: string) {
  const res = await fetch(uri)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${uri}: ${await res.text()}`)
  }
  return res.text()
}

async function myfetchjson(uri: string) {
  return JSON.parse(await myfetchtext(uri))
}

// produce a source-map resolved stack trace
// reference code https://stackoverflow.com/a/77158517/2129219
const sourceMaps: Record<string, SourceMapConsumer> = {}
const sourceMappingUrlRe = /\/\/# sourceMappingURL=(.*)/
const stackLineRe = /(.*)((?:https?|file):\/\/.*):(\d+):(\d+)/

async function getSourceMapFromUri(uri: string) {
  if (sourceMaps[uri]) {
    return sourceMaps[uri]
  }
  const uriQuery = new URL(uri).search
  const currentScriptContent = await myfetchtext(uri)
  const mapUri = sourceMappingUrlRe.exec(currentScriptContent)?.[1] ?? ''
  const data = await myfetchjson(new URL(mapUri, uri).href + uriQuery)
  const map = new SourceMapConsumer(data)
  sourceMaps[uri] = map
  return map
}

async function mapStackTrace(stack: string) {
  const mappedStack = []
  for (const line of stack.split('\n')) {
    const match = stackLineRe.exec(line)
    if (!match) {
      mappedStack.push(line)
      continue
    }

    const uri = match[2]!
    const consumer = await getSourceMapFromUri(uri)
    const pos = consumer.originalPositionFor({
      line: +match[3]!,
      column: +match[4]!,
    })

    if (!pos.source || !pos.line || !pos.column) {
      mappedStack.push(line)
      continue
    }

    mappedStack.push(
      `${pos.source}:${pos.line}:${pos.column + 1} (${match[1]!.trim()})`,
    )
  }
  return mappedStack.join('\n')
}

const MAX_ERR_LEN = 10_000

// Chrome has the error message in the stacktrace, firefox doesn't.
// Remove it since it can be very long due to mobx-state-tree stuff
function stripMessage(trace: string, error: unknown) {
  return trace.startsWith('Error:') ? trace.slice(`${error}`.length) : trace
}

function getStackTrace(error: unknown) {
  return typeof error === 'object' && error !== null && 'stack' in error
    ? `${error.stack}`
    : ''
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
  const errorText = error ? `${error}` : ''
  const stackTrace = stripMessage(getStackTrace(error), errorText)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setMappedStackTrace(await mapStackTrace(stackTrace))
      } catch (e) {
        console.error(e)
        setMappedStackTrace(stackTrace)
        setSecondaryError(e)
      }
    })()
  }, [stackTrace])

  // @ts-expect-error
  const version = window.JBrowseSession?.version
  const errorBoxText = [
    secondaryError
      ? 'Error loading source map, showing raw stack trace below:'
      : '',
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || 'No stack trace available',
    version ? `JBrowse ${version}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <Dialog open onClose={onClose} title="Stack trace" maxWidth="xl">
      <DialogContent>
        {mappedStackTrace === undefined ? (
          <LoadingEllipses variant="h6" />
        ) : (
          <ErrorMessageStackTraceContents text={errorBoxText} extra={extra} />
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
