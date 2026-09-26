import { observer } from 'mobx-react'

import ChordDisplayFrame from '../../chords/ChordDisplayFrame.tsx'
import ShapePaths from '../../chords/ShapePaths.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'

const ChordSyntenyDisplay = observer(function ChordSyntenyDisplay({
  display,
}: {
  display: RibbonDisplayModel
}) {
  return (
    <ChordDisplayFrame display={display}>
      <ShapePaths
        display={display}
        testid="syntenyRibbonRenderer"
        only="highlighted"
      />
    </ChordDisplayFrame>
  )
})

export default ChordSyntenyDisplay
