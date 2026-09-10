import { observer } from 'mobx-react'

import ChordDisplayFrame from '../../chords/ChordDisplayFrame.tsx'
import Ribbons from '../../chords/Ribbons.tsx'

import type { RibbonDisplayModel } from '../../chords/types.ts'

const ChordSyntenyDisplay = observer(function ChordSyntenyDisplay({
  display,
}: {
  display: RibbonDisplayModel
}) {
  return (
    <ChordDisplayFrame display={display}>
      <Ribbons display={display} />
    </ChordDisplayFrame>
  )
})

export default ChordSyntenyDisplay
