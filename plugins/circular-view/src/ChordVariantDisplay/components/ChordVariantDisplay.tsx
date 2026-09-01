import { observer } from 'mobx-react'

import Chords from '../../chords/Chords.tsx'
import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: ChordDisplayModel
}) {
  const phase = display.displayPhase
  return (
    <g data-display-phase={phase}>
      {phase === 'error' ? (
        <DisplayError
          model={display}
          onClick={() => {
            display.openErrorDialog()
          }}
          onRetry={() => {
            display.reload()
          }}
        />
      ) : phase === 'loading' ? (
        <Loading model={display} />
      ) : (
        <Chords display={display} />
      )}
    </g>
  )
})

export default ChordVariantDisplay
