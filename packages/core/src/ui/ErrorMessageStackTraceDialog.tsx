import { readConfObject } from '../configuration/index.ts'
import { hasSharedArrayBuffer } from '../util/stopToken.ts'
import { useFetch } from '../util/useFetch.ts'
import CopyToClipboardButton from './CopyToClipboardButton.tsx'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import InfoDialog from './InfoDialog.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import { formatErrorStack } from './formatErrorStack.ts'
import { preferredRenderer } from './getGraphicsCapabilities.ts'
import { mapStackTrace } from './mapStackTrace.ts'
import { useGraphicsCapabilities } from './useGraphicsCapabilities.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'

interface SessionGlobal {
  version?: string
  rpcManager: {
    mainConfiguration: AnyConfigurationModel
    defaultDriverName: string
  }
}

const MAX_ERR_LEN = 10_000

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
  const stackTrace = formatErrorStack(error)

  const { data: mappedStackTrace, isLoading } = useFetch(
    ['mappedStackTrace', stackTrace],
    () => mapStackTrace(stackTrace),
  )

  // The backend in use, not a list of the ones available: the preferred renderer
  // already says which rungs exist, since Canvas2D means neither and WebGL2
  // means no WebGPU. See getGraphicsCapabilities.
  const graphicsInfo = graphicsCapabilities
    ? `Graphics: ${preferredRenderer(graphicsCapabilities)}`
    : ''
  const gpuInfo = graphicsCapabilities?.gpuVendor
    ? `GPU: ${graphicsCapabilities.gpuVendor}${graphicsCapabilities.gpuArchitecture ? ` (${graphicsCapabilities.gpuArchitecture})` : ''}`
    : ''
  // Both paths cancel at await boundaries by posted message; SharedArrayBuffer
  // additionally interrupts a synchronous worker loop mid-run.
  const sabInfo = `Worker abort: postMessage${hasSharedArrayBuffer ? ' + SharedArrayBuffer' : ''}`

  const session = (window as unknown as { JBrowseSession?: SessionGlobal })
    .JBrowseSession
  const version = session?.version
  const rpcManager = session?.rpcManager
  const rpcInfo = rpcManager
    ? `RPC: ${readConfObject(rpcManager.mainConfiguration, 'defaultDriver') || rpcManager.defaultDriverName}`
    : ''
  const errorBoxText = [
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || stackTrace || 'No stack trace available',
    '--- environment ---',
    version ? `JBrowse ${version}` : '',
    graphicsInfo,
    gpuInfo,
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
    <InfoDialog
      open
      onClose={() => {
        onClose()
      }}
      maxWidth="xl"
      title="Stack trace"
      actions={
        <CopyToClipboardButton
          variant="contained"
          color="secondary"
          value={errorBoxText}
          copiedLabel="Copied!"
        >
          Copy stack trace to clipboard
        </CopyToClipboardButton>
      }
    >
      {isLoading ? (
        <LoadingEllipses variant="h6" />
      ) : (
        <ErrorMessageStackTraceContents text={errorBoxText} extra={extra} />
      )}
    </InfoDialog>
  )
}
