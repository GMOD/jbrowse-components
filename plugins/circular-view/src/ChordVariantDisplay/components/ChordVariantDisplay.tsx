import { observer } from 'mobx-react'

import ChordDisplayFrame from '../../chords/ChordDisplayFrame.tsx'
import ShapePaths from '../../chords/ShapePaths.tsx'

import type { ChordDisplayModel } from '../../chords/types.ts'

const ChordVariantDisplay = observer(function ChordVariantDisplay({
  display,
}: {
  display: ChordDisplayModel
}) {
  return (
    <ChordDisplayFrame display={display}>
      <ShapePaths
        display={display}
        testid="structuralVariantChordRenderer"
        only="highlighted"
      />
    </ChordDisplayFrame>
  )
})

export default ChordVariantDisplay
