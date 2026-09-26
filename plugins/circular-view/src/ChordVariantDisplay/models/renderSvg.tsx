import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'

import ShapePaths from '../../chords/ShapePaths.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

// `awaitSvgReady` fails the export on a chord track whose data wouldn't load,
// so nothing here draws an error. A radial display has no width/height box to
// host a message rect — which is why the on-screen path needs a bespoke
// `<DisplayError>` fitted to the circle, and why a figure has nowhere sensible
// to put one at all.
export async function renderSvg(display: ChordDisplayModel) {
  await awaitSvgReady(display)
  return display.ready ? (
    <ShapePaths
      display={display}
      testid="structuralVariantChordRenderer"
      only="all"
    />
  ) : null
}
