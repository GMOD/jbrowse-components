import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'

import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'
import DisplayError from '../components/DisplayError.tsx'

import type { ChordDisplayModel } from '../../ChordRenderer/types.ts'

export async function renderSvg(display: ChordDisplayModel) {
  await awaitSvgReady(display)
  return display.error ? (
    <DisplayError model={display} radius={display.radiusPx} />
  ) : display.features ? (
    <SVChordsReactComponent display={display} />
  ) : null
}
