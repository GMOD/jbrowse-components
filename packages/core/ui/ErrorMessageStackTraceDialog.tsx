import React, { useEffect, useState } from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  Link,
  Typography,
} from '@mui/material'
import Dialog from './Dialog'

import { RawSourceMap, SourceMapConsumer } from 'source-map-js'
import LoadingEllipses from './LoadingEllipses'
import copy from 'copy-to-clipboard'

// produce a source-map resolved stack trace
// reference code https://stackoverflow.com/a/77158517/2129219
const sourceMaps: Record<string, RawSourceMap> = {}
async function getSourceMapFromUri(uri: string) {
  if (sourceMaps[uri] != undefined) {
    return sourceMaps[uri]
  }
  const uriQuery = new URL(uri).search
  const currentScriptContent = await (await fetch(uri)).text()

  let mapUri =
    new RegExp(/\/\/# sourceMappingURL=(.*)/).exec(currentScriptContent)?.[1] ||
    ''
  mapUri = new URL(mapUri, uri).href + uriQuery

  const map = await (await fetch(mapUri)).json()

  sourceMaps[uri] = map

  return map
}

async function mapStackTrace(stack: string) {
  const stackLines = stack.split('\n')
  const mappedStack = []

  for (const line of stackLines) {
    const match = new RegExp(/(.*)(http:\/\/.*):(\d+):(\d+)/).exec(line)
    if (match === null) {
      mappedStack.push(line)
      continue
    }

    const uri = match[2]
    const consumer = new SourceMapConsumer(await getSourceMapFromUri(uri))

    const originalPosition = consumer.originalPositionFor({
      line: parseInt(match[3]),
      column: parseInt(match[4]),
    })

    if (
      originalPosition.source === null ||
      originalPosition.line === null ||
      originalPosition.column === null
    ) {
      mappedStack.push(line)
      continue
    }

    mappedStack.push(
      `${originalPosition.source}:${originalPosition.line}:${
        originalPosition.column + 1
      }`,
    )
  }

  return mappedStack.join('\n')
}

export default function ErrorMessageStackTraceDialog({
  error,
  onClose,
}: {
  onClose: () => void
  error: Error
}) {
  const [mappedStackTrace, setMappedStackTrace] = useState('')
  const [secondaryError, setSecondaryError] = useState<unknown>()
  const [clicked, setClicked] = useState(false)
  const stackTrace = `${error.stack}`
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
  return (
    <Dialog open onClose={onClose} title="Stack trace" maxWidth="xl">
      <DialogContent>
        <Typography>
          Post a new issue with this stack trace at{' '}
          <Link href="https://github.com/GMOD/jbrowse-components/issues/new/choose">
            GitHub
          </Link>{' '}
          or send an email to{' '}
          <Link href="mailto:jbrowse2dev@gmail.com">jbrowse2dev@gmail.com</Link>
        </Typography>
        {mappedStackTrace ? (
          <div>
            <Button
              style={{ float: 'right' }}
              variant="contained"
              onClick={() => {
                copy(mappedStackTrace)
                setClicked(true)
                setTimeout(() => {
                  setClicked(false)
                }, 1000)
              }}
            >
              {clicked ? 'Copied!' : 'Copy stack trace to clipboard'}
            </Button>

            <pre
              style={{
                background: 'lightgrey',
                border: '1px solid black',
                overflow: 'auto',
                margin: 20,
              }}
            >
              {secondaryError
                ? 'Error loading source map, showing raw stack trace below:\n'
                : ''}
              {mappedStackTrace}
            </pre>
          </div>
        ) : (
          <LoadingEllipses />
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
