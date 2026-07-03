import { Fragment } from 'react'

import { observer } from 'mobx-react'

import type { SequenceFeatureDetailsModel } from '../model.ts'

// Cumulative count of non-space characters before each chunk. Coordinate
// spacing inserts spaces into chunks, so the visible character offset differs
// from the underlying sequence index that `highlight` is keyed on.
function chunkSequenceOffsets(chunks: string[]) {
  const offsets: number[] = []
  let total = 0
  for (const chunk of chunks) {
    offsets.push(total)
    total += chunk.replaceAll(' ', '').length
  }
  return offsets
}

const SequenceDisplay = observer(function SequenceDisplay({
  chunks,
  start,
  color,
  strand = 1,
  coordStart = start,
  highlight,
  model,
}: {
  chunks: string[]
  start: number
  coordStart?: number
  strand?: number
  color?: string
  // Maps a 0-based sequence index (ignoring coordinate-spacing spaces) to a
  // background color, or undefined to use the base `color`. When provided, each
  // character is rendered in its own span so it can be highlighted individually.
  highlight?: (index: number) => string | undefined
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model
  const sequenceOffsets = highlight ? chunkSequenceOffsets(chunks) : undefined

  return chunks.map((chunk, idx) => {
    const f = coordStart - (start % charactersPerRow)
    const prefix =
      idx > 0 || start % charactersPerRow === 0
        ? `${`${f + idx * strand * charactersPerRow}`.padStart(4)}   `
        : ''
    const isLastChunk = idx === chunks.length - 1
    // a partial final row (not filled to charactersPerRow) gets no trailing
    // newline; every full row does
    const lastRowCharCount =
      chunk.replaceAll(' ', '').length +
      (idx === 0 ? start % charactersPerRow : 0)
    const postfix =
      isLastChunk && lastRowCharCount !== charactersPerRow
        ? null
        : showCoordinates
          ? ' \n'
          : ''
    return (
      /* biome-ignore lint/suspicious/noArrayIndexKey: */
      // eslint-disable-next-line @eslint-react/no-array-index-key -- static positional list of sequence chunks, never reorder
      <Fragment key={`${chunk}-${idx}`}>
        {showCoordinates ? prefix : null}
        {highlight && sequenceOffsets ? (
          <HighlightedChunk
            chunk={chunk}
            sequenceOffset={sequenceOffsets[idx]!}
            color={color}
            highlight={highlight}
          />
        ) : (
          <span style={{ background: color }}>{chunk}</span>
        )}
        {postfix}
      </Fragment>
    )
  })
})

// Renders a chunk one character per span, applying `highlight` to each
// non-space character. Spaces keep the base `color` so the row background stays
// contiguous.
function HighlightedChunk({
  chunk,
  sequenceOffset,
  color,
  highlight,
}: {
  chunk: string
  sequenceOffset: number
  color?: string
  highlight: (index: number) => string | undefined
}) {
  let seqIndex = sequenceOffset
  const spans = []
  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i]!
    const background = ch === ' ' ? color : (highlight(seqIndex++) ?? color)
    spans.push(
      <span key={i} style={{ background }}>
        {ch}
      </span>,
    )
  }
  return <>{spans}</>
}

export default SequenceDisplay
