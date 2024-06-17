import React from 'react'
import { SequenceFeatureDetailsModel } from '../model'
import { observer } from 'mobx-react'

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
  const { width, showCoordinates } = model

  return chunks.map((chunk, idx) => {
    const f = coordStart - (start % 100)
    const prefix =
      (idx == 0 && start % width == 0) || idx > 0
        ? `${f + idx * strand * width}`.padStart(4) + '   '
        : ''
    const postfix =
      idx === chunks.length - 1 &&
      (chunks.at(-1)?.replaceAll(' ', '').length || 0) +
        (idx === 0 ? start % 100 : 0) !==
        width
        ? null
        : showCoordinates
          ? ' \n'
          : ''
    return (
      <React.Fragment key={`${chunk}-${idx}`}>
        {showCoordinates ? prefix : null}
        <span style={{ background: color }}>{chunk}</span>
        {postfix}
      </React.Fragment>
    )
  })
})

export default SequenceDisplay
