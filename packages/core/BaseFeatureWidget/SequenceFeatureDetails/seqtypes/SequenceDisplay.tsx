import React from 'react'
import { observer } from 'mobx-react'
import type { SequenceFeatureDetailsModel } from '../model'

const SequenceDisplay = observer(function ({
  chunks,
  start,
  color,
  strand = 1,
  coordStart = start,
  model,
}: {
  chunks: string[]
  start: number
  coordStart?: number
  strand?: number
  color?: string
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model

  return chunks.map((chunk, idx) => {
    const f = coordStart - (start % charactersPerRow)
    const prefix =
      (idx === 0 && start % charactersPerRow === 0) || idx > 0
        ? `${`${f + idx * strand * charactersPerRow}`.padStart(4)}   `
        : ''
    const postfix =
      idx === chunks.length - 1 &&
      (chunks.at(-1)?.replaceAll(' ', '').length || 0) +
        (idx === 0 ? start % charactersPerRow : 0) !==
        charactersPerRow
        ? null
        : showCoordinates
          ? ' \n'
          : ''
    return (
      /* biome-ignore lint/suspicious/noArrayIndexKey: */
      <React.Fragment key={`${chunk}-${idx}`}>
        {showCoordinates ? prefix : null}
        <span style={{ background: color }}>{chunk}</span>
        {postfix}
      </React.Fragment>
    )
  })
})

export default SequenceDisplay
