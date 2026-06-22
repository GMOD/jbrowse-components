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
 * Off-screen renderers (SVG export, headless jbrowse-img) must wait until the
 * display reaches a terminal state before reading its data. That whole policy
 * lives in `svgReady`; this is the one shared way to await it, so renderers
 * never re-inline `data != null || error || …`.
 */
export function awaitSvgReady(model: Pick<SvgExportable, 'svgReady'>) {
  return when(() => model.svgReady)
}
