import { when } from 'mobx'

/**
 * The contract every GPU display's `renderSvg` relies on: a `svgReady` gate
 * (the per-display terminal-state getter — see MultiRegionDisplayMixin /
 * GlobalDataDisplayMixin) and the `error` it renders through `SVGErrorBox`.
 * Duck-typed `renderSvg` model interfaces extend this so the compiler catches a
 * missing field instead of it surfacing as a runtime hang or a silent blank.
 */
export interface SvgExportable {
  svgReady: boolean
  error: unknown
}

/**
 * Off-screen export should never hang forever if a display's `svgReady` never
 * resolves (a fetch that never settles, or a display that omits its
 * `dataLoaded` / `svgReady` override). Past this bound we reject with a
 * diagnostic error — which surfaces as a failed export / `SVGErrorBox` — rather
 * than a silent infinite wait (invisible in headless jbrowse-img / CI).
 */
const SVG_READY_TIMEOUT_MS = 60000

/**
 * Off-screen renderers (SVG export, headless jbrowse-img) must wait until the
 * display reaches a terminal state before reading its data. That whole policy
 * lives in `svgReady`; this is the one shared way to await it, so renderers
 * never re-inline `data != null || error || …`.
 */
export async function awaitSvgReady(
  model: Pick<SvgExportable, 'svgReady'>,
  timeout = SVG_READY_TIMEOUT_MS,
) {
  try {
    await when(() => model.svgReady, { timeout })
  } catch {
    throw new Error(
      `SVG export timed out after ${timeout}ms: the display never became ready ` +
        `for export (svgReady stayed false). This usually means it never reached ` +
        `a terminal state — a fetch that never resolves, or a display missing its ` +
        `dataLoaded / svgReady override.`,
    )
  }
}
