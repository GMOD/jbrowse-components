import { observer } from 'mobx-react'

import { coordLabelWidth, splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { SequenceFeatureDetailsModel } from '../model.ts'

// One uninterrupted string in its own coordinate space -- the stitched CDS, the
// translated peptide -- so rows count from 0 and there is nothing to thread
// across segments the way renderSequenceSegments does for the genome-based
// types. The counterpart to that helper, and the reason neither of those
// seqtypes has to know how a row is laid out.
const PlainSequence = observer(function PlainSequence({
  str,
  color,
  highlight,
  model,
}: {
  str: string
  color: string
  // maps a 0-based index in `str` to a background color; see SequenceDisplay
  highlight?: (index: number) => string | undefined
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model
  const { segments } = splitString({ str, charactersPerRow, showCoordinates })
  return (
    <SequenceDisplay
      model={model}
      color={color}
      chunks={segments}
      coordStart={0}
      labelWidth={coordLabelWidth({
        firstCoord: 0,
        totalLength: str.length,
        charactersPerRow,
        strand: 1,
      })}
      highlight={highlight}
    />
  )
})

export default PlainSequence
