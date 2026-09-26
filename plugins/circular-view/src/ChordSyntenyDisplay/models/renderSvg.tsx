import { awaitSvgReady, throwOnExportErrors } from '@jbrowse/core/svg/svgReady'

import ShapePaths from '../../chords/ShapePaths.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'

// `awaitSvgReady` fails the export on a track whose data wouldn't load, so
// nothing here draws an error: a radial display has no width/height box to host
// a message rect, which is why the on-screen path needs the circle-shaped
// `<DisplayError>` instead.
export async function renderSvg(display: RibbonDisplayModel) {
  await awaitSvgReady(display)
  throwOnExportErrors([display.displayError])
  return display.ready ? (
    <ShapePaths display={display} testid="syntenyRibbonRenderer" only="all" />
  ) : null
}
