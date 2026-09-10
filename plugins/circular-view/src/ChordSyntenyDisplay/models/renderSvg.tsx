import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'

import Ribbons from '../../chords/Ribbons.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'

// `awaitSvgReady` fails the export on a track whose data wouldn't load, so
// nothing here draws an error: a radial display has no width/height box to host
// a message rect, which is why the on-screen path needs the circle-shaped
// `<DisplayError>` instead.
export async function renderSvg(display: RibbonDisplayModel) {
  await awaitSvgReady(display)
  return display.ready ? <Ribbons display={display} /> : null
}
