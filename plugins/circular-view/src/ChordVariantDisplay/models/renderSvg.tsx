import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'

import Chords from '../../chords/Chords.tsx'
import DisplayError from '../components/DisplayError.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

export async function renderSvg(display: ChordDisplayModel) {
  await awaitSvgReady(display)
  return display.error ? (
    <DisplayError model={display} />
  ) : display.ready ? (
    <Chords display={display} />
  ) : null
}
