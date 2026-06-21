import { observer } from 'mobx-react'

import {
  convertCodingSequenceToPeptides,
  translExceptProteinPositions,
} from '../../../util/convertCodingSequenceToPeptides.ts'
import SequenceLegend from '../SequenceLegend.tsx'
import { proteinColor, translExceptColor } from '../consts.ts'
import { splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { TranslExcept } from '../../../util/geneticCodes.ts'
import type { Feat } from '../../util.tsx'
import type { SequenceFeatureDetailsModel } from '../model.ts'

// transl_except amino-acid overrides we annotate, in display order.
const TRANSL_EXCEPT_LABELS = [
  { aa: '*', name: 'polyA-completed stop' },
  { aa: 'U', name: 'selenocysteine' },
  { aa: 'O', name: 'pyrrolysine' },
]

// Produce a human-readable note for any transl_except amino acids that were
// applied.
function translExceptNote(translExcept: TranslExcept[]): string | undefined {
  const parts = TRANSL_EXCEPT_LABELS.flatMap(({ aa, name }) => {
    const n = translExcept.filter(e => e.aa === aa).length
    return n > 0
      ? [`${n} ${name}${n > 1 ? 's' : ''} (${aa}) from transl_except`]
      : []
  })
  return parts.length > 0 ? parts.join('; ') : undefined
}

const ProteinSequence = observer(function ProteinSequence({
  cds,
  sequence,
  model,
  codonTable,
  starts,
  translExcept,
}: {
  cds: Feat[]
  sequence: string
  model: SequenceFeatureDetailsModel
  codonTable: Record<string, string>
  starts?: string[]
  translExcept?: TranslExcept[]
}) {
  const { charactersPerRow, showCoordinates } = model
  const str = convertCodingSequenceToPeptides({
    cds,
    sequence,
    codonTable,
    starts,
    translExcept,
  })
  const { segments } = splitString({ str, charactersPerRow, showCoordinates })
  const note = translExcept ? translExceptNote(translExcept) : undefined
  const highlightPositions = translExcept?.length
    ? translExceptProteinPositions({ cds, translExcept })
    : undefined

  return (
    <>
      {note ? (
        <SequenceLegend items={[{ color: translExceptColor, label: note }]} />
      ) : null}
      <SequenceDisplay
        model={model}
        color={proteinColor}
        chunks={segments}
        start={0}
        highlight={
          highlightPositions?.size
            ? index =>
                highlightPositions.has(index) ? translExceptColor : undefined
            : undefined
        }
      />
    </>
  )
})

export default ProteinSequence
