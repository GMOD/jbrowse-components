import { effectiveRenderer } from '@jbrowse/render-core/graphicsCapabilities'
import { useGraphicsCapabilities } from '@jbrowse/render-core/useGraphicsCapabilities'

import { hasSharedArrayBuffer } from '../util/stopToken.ts'
import { useFetch } from '../util/useFetch.ts'
import CopyToClipboardButton from './CopyToClipboardButton.tsx'
import ErrorMessageStackTraceContents from './ErrorMessageStackTraceContents.tsx'
import InfoDialog from './InfoDialog.tsx'
import LoadingEllipses from './LoadingEllipses.tsx'
import { formatErrorStack } from './formatErrorStack.ts'
import { mapStackTrace } from './mapStackTrace.ts'

interface SessionGlobal {
  version?: string
  rpcManager: {
    driverName: string
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

  // The rung actually drawing, not a list of the ones available: it already says
  // which rungs exist, since Canvas2D means neither and WebGL2 means no WebGPU.
  // It accounts for a `?renderer=` pin and for the GPU banner's "disable GPU",
  // which matters most in exactly this dialog — a user reporting a rendering bug
  // has often already clicked that button, and until this moved to render-core
  // the report they sent still said WebGL2.
  const graphicsInfo = graphicsCapabilities
    ? `Graphics: ${effectiveRenderer(graphicsCapabilities)}`
    : ''
  const gpuInfo = graphicsCapabilities?.gpuVendor
    ? `GPU: ${graphicsCapabilities.gpuVendor}${graphicsCapabilities.gpuArchitecture ? ` (${graphicsCapabilities.gpuArchitecture})` : ''}`
    : ''
  // Local only, and the one field that explains a "JBrowse is slow" report with
  // nothing else wrong in it: WebGL on a software rasterizer is ~25x Canvas2D on
  // the main thread. Marked so a reader who doesn't recognize the driver string
  // still sees it.
  const glRendererInfo = graphicsCapabilities?.glRenderer
    ? `GL renderer: ${graphicsCapabilities.glRenderer}${graphicsCapabilities.softwareWebgl ? ' (SOFTWARE RASTERIZER)' : ''}`
    : ''
  // Both paths cancel at await boundaries by posted message; SharedArrayBuffer
  // additionally interrupts a synchronous worker loop mid-run.
  const sabInfo = `Worker abort: postMessage${hasSharedArrayBuffer ? ' + SharedArrayBuffer' : ''}`

  const session = (window as unknown as { JBrowseSession?: SessionGlobal })
    .JBrowseSession
  const version = session?.version
  const rpcManager = session?.rpcManager
  const rpcInfo = rpcManager ? `RPC: ${rpcManager.driverName}` : ''
  const errorBoxText = [
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || stackTrace || 'No stack trace available',
    '--- environment ---',
    version ? `JBrowse ${version}` : '',
    graphicsInfo,
    gpuInfo,
    glRendererInfo,
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
