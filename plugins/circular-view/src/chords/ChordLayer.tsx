import { createMarkBackend } from '@jbrowse/render-core/marks/backend'
import { observer } from 'mobx-react'

import { PassCanvas } from '../CircularView/components/PassCanvas.tsx'
import { chordLayerMarks } from './chordMarks.ts'

import type { CircularViewModel } from '../CircularView/model.ts'
import type { ChordBackend } from './chordPass.ts'

function chordFactory(canvas: HTMLCanvasElement): Promise<ChordBackend> {
  return createMarkBackend(canvas, chordLayerMarks)
}

/** The chords and ribbons of every chord display, above the rings. */
const ChordLayer = observer(function ChordLayer({
  view,
}: {
  view: CircularViewModel
}) {
  return (
    <PassCanvas
      pass={view.chordPass}
      factory={chordFactory}
      view={view}
      testid="circular-chord-canvas"
    />
  )
})

export default ChordLayer
