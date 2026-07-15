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
  // the too-large terminal state; `SvgChrome` renders it as a message box so an
  // over-budget region exports a labeled note instead of a silent blank.
  regionTooLarge: boolean
}

/**
 * Off-screen renderers (SVG export, headless jbrowse-img) must wait until the
 * display reaches a terminal state before reading its data. That whole policy
 * lives in `svgReady`; this is the one shared way to await it, so renderers
 * never re-inline `data != null || error || …`. No time bound: `svgReady` is a
 * terminal state (data loaded, or error / too-large), so it resolves once the
 * fetch it observes settles. If a throwing `svgReady` getter rejects the wait,
 * that error propagates faithfully rather than being masked.
 */
export async function awaitSvgReady(model: Pick<SvgExportable, 'svgReady'>) {
  await when(() => model.svgReady)
}
