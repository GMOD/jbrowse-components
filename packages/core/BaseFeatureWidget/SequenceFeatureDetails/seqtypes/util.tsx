import React from 'react'
import { SequenceFeatureDetailsModel } from '../model'
import { observer } from 'mobx-react'

export function splitString(str: string, size: number, initial: number) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  let iter = 0
  let offset = 0
  for (; iter < numChunks + 1; ++iter) {
    const inc = iter === 0 ? size - initial : size
    const r = str.slice(offset, offset + inc)
    if (!r) {
      break
    }
    chunks[iter] = r
    offset += inc
  }

  return {
    segments: chunks,
    remainder: ((chunks.at(-1)?.length || 0) + (iter < 2 ? initial : 0)) % size,
  }
}
const SequenceDisplay = observer(function ({
  chunks,
  start,
  color,
  model,
}: {
  chunks: string[]
  start: number
  color?: string
  model: SequenceFeatureDetailsModel
}) {
  const { width, showCoordinates } = model
  return chunks.map((s, idx) => {
    const f = Math.floor(start / 100) * 100
    const prefix =
      (idx == 0 && start % width == 0) || idx > 0
        ? `${f + idx * width}`.padStart(4) + '   '
        : ''
    const postfix =
      idx === chunks.length - 1 &&
      (chunks.at(-1)?.length || 0) + (idx === 0 ? start % 100 : 0) !== width
        ? null
        : '\n'
    return (
      <React.Fragment key={s + '-' + idx}>
        {showCoordinates ? prefix : null}
        <span style={{ background: color }}>{s}</span>
        {postfix}
      </React.Fragment>
    )
  })
})

export default SequenceDisplay
