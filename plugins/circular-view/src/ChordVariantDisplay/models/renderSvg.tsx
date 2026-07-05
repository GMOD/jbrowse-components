import { when } from 'mobx'

import SVChordsReactComponent from '../../ChordRenderer/ReactComponent.tsx'
import DisplayError from '../components/DisplayError.tsx'

import type { ChordDisplayModel } from '../../ChordRenderer/types.ts'

export async function renderSvg(display: ChordDisplayModel) {
  await when(() => display.ready || display.error !== undefined)
  return display.error ? (
    <DisplayError model={display} radius={display.radiusPx} />
  ) : display.features ? (
    <SVChordsReactComponent display={display} />
  ) : null
}
