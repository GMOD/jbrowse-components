import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material'
import { SourceMapConsumer } from 'source-map-js'

import CopyToClipboardButton from './CopyToClipboardButton.tsx'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import {
  availableRenderers,
  preferredRenderer,
} from './getGraphicsCapabilities.ts'
import { useGraphicsCapabilities } from './useGraphicsCapabilities.ts'
import { readConfObject } from '../configuration/index.ts'
import { hasSharedArrayBuffer } from '../util/stopToken.ts'
import { useFetch } from '../util/useFetch.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'

interface SessionGlobal {
  version?: string
  rpcManager: {
    mainConfiguration: AnyConfigurationModel
    defaultDriverName: string
  }
}

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
const protocolRe = /(?:https?|file):\/\//
const digitsRe = /^\d+$/

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

// parses a "frame" line like "  at f (file:///foo.js:12:34)" into its
// prefix ("  at f ("), source uri, line, and column, or undefined if the
// line doesn't end with a uri:line:column reference
function parseStackLine(line: string) {
  const protocolMatch = protocolRe.exec(line)
  if (!protocolMatch) {
    return undefined
  }

  const urlStart = protocolMatch.index
  const rest = line.slice(urlStart).replace(/\)$/, '')
  const lastColon = rest.lastIndexOf(':')
  const secondLastColon = rest.lastIndexOf(':', lastColon - 1)
  const lineStr = rest.slice(secondLastColon + 1, lastColon)
  const columnStr = rest.slice(lastColon + 1)

  return secondLastColon > 0 &&
    digitsRe.test(lineStr) &&
    digitsRe.test(columnStr)
    ? {
        prefix: line.slice(0, urlStart).trim(),
        uri: rest.slice(0, secondLastColon),
        line: +lineStr,
        column: +columnStr,
      }
    : undefined
}

async function mapStackTrace(stack: string) {
  const mappedStack = []
  for (const line of stack.split('\n')) {
    const frame = parseStackLine(line)
    if (frame) {
      const consumer = await getSourceMapFromUri(frame.uri)
      const pos = consumer.originalPositionFor(frame)
      mappedStack.push(
        pos.source && pos.line && pos.column
          ? `${pos.source}:${pos.line}:${pos.column + 1} (${frame.prefix})`
          : line,
      )
    } else {
      mappedStack.push(line)
    }
  }
  return mappedStack.join('\n')
}

const MAX_ERR_LEN = 10_000

// Chrome prepends the error message to the stack trace; Firefox doesn't.
// Strip it to avoid duplication (the message is already shown above the trace).
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
  const graphicsCapabilities = useGraphicsCapabilities()
  const errorText = error ? `${error}` : ''
  const stackTrace = stripMessage(getStackTrace(error), errorText)

  const {
    data: mappedStackTrace,
    error: secondaryError,
    isLoading,
  } = useFetch(['mappedStackTrace', stackTrace], () =>
    mapStackTrace(stackTrace),
  )

  const graphicsInfo = graphicsCapabilities
    ? `Graphics: ${preferredRenderer(graphicsCapabilities)} (${availableRenderers(graphicsCapabilities).join(', ')})`
    : ''
  const sabInfo = `Worker abort: ${hasSharedArrayBuffer ? 'SharedArrayBuffer' : 'XHR fallback'}`

  const session = (window as unknown as { JBrowseSession?: SessionGlobal })
    .JBrowseSession
  const version = session?.version
  const rpcManager = session?.rpcManager
  const rpcInfo = rpcManager
    ? `RPC: ${readConfObject(rpcManager.mainConfiguration, 'defaultDriver') || rpcManager.defaultDriverName}`
    : ''
  const errorBoxText = [
    secondaryError
      ? 'Error loading source map, showing raw stack trace below:'
      : '',
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || stackTrace || 'No stack trace available',
    '--- environment ---',
    version ? `JBrowse ${version}` : '',
    graphicsInfo,
    rpcInfo,
    sabInfo,
    `Cross-origin isolated: ${crossOriginIsolated}`,
    `CPU cores: ${navigator.hardwareConcurrency}`,
    `Device pixel ratio: ${window.devicePixelRatio}`,
    `Window size: ${window.innerWidth}x${window.innerHeight}`,
    `URL: ${window.location.href}`,
    `User agent: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <Dialog
      open
      onClose={() => {
        onClose()
      }}
      maxWidth="xl"
    >
      <DialogTitle>
        Stack trace
        <IconButton
          onClick={() => {
            onClose()
          }}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <LoadingEllipses variant="h6" />
        ) : (
          <ErrorMessageStackTraceContents text={errorBoxText} extra={extra} />
        )}
      </DialogContent>
      <DialogActions>
        <CopyToClipboardButton
          variant="contained"
          color="secondary"
          value={errorBoxText}
          copiedLabel="Copied!"
        >
          Copy stack trace to clipboard
        </CopyToClipboardButton>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            onClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
