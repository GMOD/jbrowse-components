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
  coordStart,
  labelWidth,
  remainder = 0,
  color,
  strand = 1,
  highlight,
  onHoverBase,
  model,
}: {
  chunks: string[]
  // coordinate label for the first character of `chunks`
  coordStart: number
  // width every coordinate label is padded to. Panel-wide (see
  // coordLabelWidth), not per-segment, so rows stay column-aligned even where
  // the labels either side of a row gain a digit
  labelWidth: number
  // characters a prior segment already placed on the row this one continues, so
  // the first chunk knows it is mid-row
  remainder?: number
  strand?: number
  color?: string
  // Maps a 0-based sequence index (ignoring coordinate-spacing spaces) to a
  // background color, or undefined to use the base `color`. When provided, each
  // character is rendered in its own span so it can be highlighted individually.
  highlight?: (index: number) => string | undefined
  // Reports the 0-based genomic base under the cursor as it moves over a chunk,
  // resolved from `coordStart`/`strand` (only wired for contiguous genomic
  // modes, where those are true genomic coordinates). Chunk-level, so span count
  // stays one-per-row regardless of sequence length.
  onHoverBase?: (base0: number) => void
  model: SequenceFeatureDetailsModel
}) {
  const { charactersPerRow, showCoordinates } = model
  // rows only become visible through the labels and line breaks that
  // showCoordinates turns on; without it the container wraps the text itself,
  // so collapsing to a single span renders identically out of far fewer nodes
  // (a 100kb gene is ~1000 rows)
  const rows = showCoordinates ? chunks : [chunks.join('')]
  const sequenceOffsets =
    highlight || onHoverBase ? chunkSequenceOffsets(rows) : undefined

  return rows.map((chunk, idx) => {
    // coordinate of the row's first column, which for a mid-row first chunk sits
    // `remainder` characters back
    const f = coordStart - remainder * strand
    const prefix =
      idx > 0 || remainder === 0
        ? `${`${f + idx * strand * charactersPerRow}`.padStart(labelWidth)}   `
        : ''
    const isLastChunk = idx === rows.length - 1
    // a partial final row (not filled to charactersPerRow) gets no trailing
    // newline; every full row does
    const lastRowCharCount =
      chunk.replaceAll(' ', '').length + (idx === 0 ? remainder : 0)
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
          <span
            style={{ background: color }}
            onMouseMove={
              onHoverBase && sequenceOffsets
                ? event => {
                    const k =
                      sequenceOffsets[idx]! +
                      nonSpaceCharsBeforeCursor(event, chunk)
                    onHoverBase(coordStart + strand * k - 1)
                  }
                : undefined
            }
          >
            {chunk}
          </span>
        )}
        {postfix}
      </Fragment>
    )
  })
})

// Non-space characters before the cursor within a monospace chunk span, i.e.
// the sequence index (within the chunk) of the base under the cursor. Uses the
// span's measured width since every glyph is equal-width; coordinate-spacing
// spaces are skipped so the index lines up with the underlying sequence.
function nonSpaceCharsBeforeCursor(
  event: React.MouseEvent<HTMLSpanElement>,
  chunk: string,
) {
  const rect = event.currentTarget.getBoundingClientRect()
  const frac = (event.clientX - rect.left) / rect.width
  const col = Math.min(
    chunk.length - 1,
    Math.max(0, Math.floor(frac * chunk.length)),
  )
  let count = 0
  for (let i = 0; i < col; i++) {
    if (chunk[i] !== ' ') {
      count++
    }
  }
  return count
}

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
