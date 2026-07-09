import { splitString } from '../util.ts'
import SequenceDisplay from './SequenceDisplay.tsx'

import type { SequenceFeatureDetailsModel } from '../model.ts'

export interface SeqSegment {
  key: string
  str: string
  color?: string
}

// An up/downstream flank contributes a segment only when its sequence was
// fetched; `transform` applies e.g. the cDNA lower-casing. Returns 0 or 1
// segments so it can be spread into a segment list.
export function flankSegment(
  key: string,
  str: string | undefined,
  color: string,
  transform: (s: string) => string = s => s,
): SeqSegment[] {
  return str ? [{ key, str: transform(str), color }] : []
}

// Lays a list of colored segments (upstream, exons/UTRs/introns, downstream)
// into <SequenceDisplay> rows, threading the running row-fill remainder and
// genomic coordinate across segments so rows and coordinate labels stay
// continuous. Segments that produce no visible characters are skipped. strand
// `mult` is +1 (forward) or -1 (reverse, where coordinates count down).
export function renderSequenceSegments({
  segments,
  model,
  mult,
  coordStart,
}: {
  segments: SeqSegment[]
  model: SequenceFeatureDetailsModel
  mult: number
  coordStart: number
}) {
  const { charactersPerRow, showCoordinates } = model
  let currStart = 0
  let currRemainder = 0
  const nodes: React.ReactNode[] = []
  for (const { key, str, color } of segments) {
    const { segments: chunks, remainder } = splitString({
      str,
      charactersPerRow,
      currRemainder,
      showCoordinates,
    })
    if (chunks.length) {
      nodes.push(
        <SequenceDisplay
          key={key}
          model={model}
          color={color}
          strand={mult}
          start={currStart}
          coordStart={coordStart + currStart}
          chunks={chunks}
        />,
      )
      currRemainder = remainder
      currStart += str.length * mult
    }
  }
  return nodes
}
