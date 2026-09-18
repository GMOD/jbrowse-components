import { keepAlignmentFeature } from './BreakpointGetFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

// SAM flags: 0x01 = paired, 0x02 = properly paired, 0x04 = unmapped
const PAIRED = 0x01
const PROPER_PAIR = 0x02
const UNMAPPED = 0x04

function fakeAlignment(flags: number, sa?: string, pairOrientation?: string) {
  const fields: Record<string, unknown> = {
    flags,
    pair_orientation: pairOrientation,
    tags: sa ? { SA: sa } : undefined,
  }
  return {
    id: () => 'r',
    get: (k: string) => fields[k],
  } as unknown as Feature
}

function fakeVariant() {
  return {
    id: () => 'v',
    get: () => undefined,
  } as unknown as Feature
}

test('a feature with no flags (variant/bedpe/fusion) always passes through', () => {
  expect(keepAlignmentFeature(fakeVariant())).toBe(true)
})

test.each`
  desc                                                      | flags                   | sa                     | pairOrientation | expected
  ${'unmapped, no SA'}                                      | ${UNMAPPED}             | ${undefined}           | ${undefined}    | ${false}
  ${'unmapped, with SA'}                                    | ${UNMAPPED}             | ${'chr1,1,+,50M,0,0;'} | ${undefined}    | ${false}
  ${'mapped unpaired, no SA'}                               | ${0}                    | ${undefined}           | ${undefined}    | ${false}
  ${'mapped unpaired, with SA'}                             | ${0}                    | ${'chr1,1,+,50M,0,0;'} | ${undefined}    | ${true}
  ${'paired, properly paired, normal (LR) orientation'}     | ${PAIRED | PROPER_PAIR} | ${undefined}           | ${'F1R2'}       | ${false}
  ${'paired, properly paired, abnormal (RL) orientation'}   | ${PAIRED | PROPER_PAIR} | ${undefined}           | ${'R1F2'}       | ${true}
  ${'paired, properly paired, no orientation recorded'}     | ${PAIRED | PROPER_PAIR} | ${undefined}           | ${undefined}    | ${false}
  ${'paired, not properly paired'}                          | ${PAIRED}               | ${undefined}           | ${undefined}    | ${true}
  ${'paired, properly paired, normal orientation, with SA'} | ${PAIRED | PROPER_PAIR} | ${'chr1,1,+,50M,0,0;'} | ${'F1R2'}       | ${true}
`('$desc -> $expected', ({ flags, sa, pairOrientation, expected }) => {
  expect(keepAlignmentFeature(fakeAlignment(flags, sa, pairOrientation))).toBe(
    expected,
  )
})
