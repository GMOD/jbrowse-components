import { effectiveRenderer } from '@jbrowse/render-core/graphicsCapabilities'
import { useGraphicsCapabilities } from '@jbrowse/render-core/useGraphicsCapabilities'

import { useFetch } from '../util/useFetch.ts'
import { version } from '../version.ts'
import { withoutSharePassword } from './errorReport.ts'
import { formatErrorStack } from './formatErrorStack.ts'
import { mapStackTrace } from './mapStackTrace.ts'

interface SessionGlobal {
  gitCommit?: string
  rpcManager: {
    driverName: string
  }
}

const MAX_ERR_LEN = 10_000

/**
 * The one text every "Send report" sends: the error, its source-mapped stack,
 * the React component stack when a boundary caught it, and the environment.
 *
 * The version is core's own, so an embedded view, which publishes no session
 * global, reports one too. `gitCommit` is for a caller whose session is
 * already gone, the fatal dialog above all; everyone else gets it off the live
 * `window.JBrowseSession`, which a product clears when its session goes away.
 */
export function useErrorReportText({
  error,
  componentStack,
  gitCommit,
}: {
  error: unknown
  componentStack?: string
  gitCommit?: string
}) {
  const graphicsCapabilities = useGraphicsCapabilities()
  const errorText = error ? `${error}` : ''
  const stackTrace = formatErrorStack(error)

  const { data: mappedStackTrace, isLoading } = useFetch(
    ['mappedStackTrace', stackTrace],
    () => mapStackTrace(stackTrace),
  )

  // The rung createGpuHal built, not a list of the ones available: it already
  // says which rungs exist, since Canvas2D means neither and WebGL2 means no
  // WebGPU. It also honours the GPU banner's "disable GPU", which matters most
  // in exactly this dialog — a user reporting a rendering bug has often already
  // clicked it.
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

  const session = (window as unknown as { JBrowseSession?: SessionGlobal })
    .JBrowseSession
  const commit = gitCommit ?? session?.gitCommit
  const rpcManager = session?.rpcManager
  const rpcInfo = rpcManager ? `RPC: ${rpcManager.driverName}` : ''
  const text = [
    errorText.length > MAX_ERR_LEN
      ? `${errorText.slice(0, MAX_ERR_LEN)}...`
      : errorText,
    mappedStackTrace || stackTrace || 'No stack trace available',
    componentStack
      ? `--- component stack ---\n${componentStack.replace(/^\n/, '')}`
      : '',
    '--- environment ---',
    `JBrowse ${version}${commit ? ` (${commit})` : ''}`,
    graphicsInfo,
    gpuInfo,
    glRendererInfo,
    rpcInfo,
    `Cross-origin isolated: ${window.crossOriginIsolated}`,
    `CPU cores: ${navigator.hardwareConcurrency}`,
    `Device pixel ratio: ${window.devicePixelRatio}`,
    `Window size: ${window.innerWidth}x${window.innerHeight}`,
    `URL: ${withoutSharePassword(window.location.href)}`,
    `User agent: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { text, isLoading }
}
