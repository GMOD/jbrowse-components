// Pair orientation string (e.g. F1R2, R2F1) for a read pair.
//
// Must be computed identically from either mate, otherwise the two mates of one
// normal pair disagree and get colored as different orientations (e.g. one gray
// LR, one teal RL). The "left" mate is therefore chosen by a total order on
// (refId, position) that both mates evaluate the same way, with a read1-first
// tie-break for equal loci. When the mate position is unknown the read1-first
// rule alone keeps the two mates consistent.
export function getPairOrientation({
  isRead1,
  isSelfRev,
  isMateRev,
  selfRefId,
  selfPos,
  mateRefId,
  matePos,
}: {
  isRead1: boolean
  isSelfRev: boolean
  isMateRev: boolean
  selfRefId: number
  selfPos: number
  mateRefId: number | undefined
  matePos: number | undefined
}) {
  const selfStrand = isSelfRev ? 'R' : 'F'
  const mateStrand = isMateRev ? 'R' : 'F'
  const selfNum = isRead1 ? '1' : '2'
  const mateNum = isRead1 ? '2' : '1'

  const selfIsLeft =
    mateRefId === undefined || matePos === undefined
      ? isRead1
      : selfRefId !== mateRefId
        ? selfRefId < mateRefId
        : selfPos !== matePos
          ? selfPos < matePos
          : isRead1

  return selfIsLeft
    ? selfStrand + selfNum + mateStrand + mateNum
    : mateStrand + mateNum + selfStrand + selfNum
}
