import { observer } from 'mobx-react'

import ChordDisplayFrame from '../../chords/ChordDisplayFrame.tsx'
import Chords from '../../chords/Chords.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: ChordDisplayModel
}) {
  return (
    <ChordDisplayFrame display={display}>
      <Chords display={display} />
    </ChordDisplayFrame>
  )
})

export default ChordVariantDisplay
