import { getPairOrientation } from './pairOrientation.ts'

// One physical FR pair seen from each mate must produce the same orientation
// string regardless of how the two mates are positioned, otherwise the pair
// gets colored as two different orientations.
function fromBothMates({
  read1Rev,
  read2Rev,
  read1Pos,
  read2Pos,
  read1Ref = 0,
  read2Ref = 0,
}: {
  read1Rev: boolean
  read2Rev: boolean
  read1Pos: number
  read2Pos: number
  read1Ref?: number
  read2Ref?: number
}) {
  const asRead1 = getPairOrientation({
    isRead1: true,
    isSelfRev: read1Rev,
    isMateRev: read2Rev,
    selfRefId: read1Ref,
    selfPos: read1Pos,
    mateRefId: read2Ref,
    matePos: read2Pos,
  })
  const asRead2 = getPairOrientation({
    isRead1: false,
    isSelfRev: read2Rev,
    isMateRev: read1Rev,
    selfRefId: read2Ref,
    selfPos: read2Pos,
    mateRefId: read1Ref,
    matePos: read1Pos,
  })
  return { asRead1, asRead2 }
}

test('normal FR pair, read1 on the left', () => {
  const { asRead1, asRead2 } = fromBothMates({
    read1Rev: false,
    read2Rev: true,
    read1Pos: 100,
    read2Pos: 300,
  })
  expect(asRead1).toBe('F1R2')
  expect(asRead2).toBe(asRead1)
})

test('mates agree when both map to the same start position', () => {
  const { asRead1, asRead2 } = fromBothMates({
    read1Rev: false,
    read2Rev: true,
    read1Pos: 100,
    read2Pos: 100,
  })
  expect(asRead1).toBe('F1R2')
  expect(asRead2).toBe(asRead1)
})

test('RF (everted) pair is RL from both mates', () => {
  const { asRead1, asRead2 } = fromBothMates({
    read1Rev: true,
    read2Rev: false,
    read1Pos: 100,
    read2Pos: 300,
  })
  expect(asRead1).toBe('R1F2')
  expect(asRead2).toBe(asRead1)
})

test('inter-chromosomal pair agrees from both mates', () => {
  const { asRead1, asRead2 } = fromBothMates({
    read1Rev: false,
    read2Rev: true,
    read1Pos: 500,
    read2Pos: 100,
    read1Ref: 1,
    read2Ref: 0,
  })
  expect(asRead2).toBe(asRead1)
})

test('unknown mate position falls back to a consistent read1-left rule', () => {
  const asRead1 = getPairOrientation({
    isRead1: true,
    isSelfRev: false,
    isMateRev: true,
    selfRefId: 0,
    selfPos: 100,
    mateRefId: undefined,
    matePos: undefined,
  })
  const asRead2 = getPairOrientation({
    isRead1: false,
    isSelfRev: true,
    isMateRev: false,
    selfRefId: 0,
    selfPos: 100,
    mateRefId: undefined,
    matePos: undefined,
  })
  expect(asRead1).toBe('F1R2')
  expect(asRead2).toBe(asRead1)
})
