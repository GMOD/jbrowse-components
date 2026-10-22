import { openFeatureWidget } from '@jbrowse/core/util'

import { openCigarWidget } from './detailWidgets.ts'

import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  openFeatureWidget: jest.fn(),
}))

function opened(hit: Omit<CigarHitResult, 'index'>) {
  jest.mocked(openFeatureWidget).mockClear()
  openCigarWidget({}, { index: 0, ...hit }, 'chr1')
  return jest.mocked(openFeatureWidget).mock.calls[0]![1]
}

// An insertion consumes no reference, so a 50 bp one at 100 opens as a point
// at 100 with its length stated, not as chr1:101..150.
test('an insertion or clip opens with an empty reference span', () => {
  for (const type of ['insertion', 'softclip', 'hardclip'] as const) {
    expect(opened({ type, position: 100, length: 50 })).toMatchObject({
      start: 100,
      end: 100,
      length: 50,
    })
  }
  expect(opened({ type: 'insertion', position: 100, length: 1 })).toMatchObject(
    { start: 100, end: 100, length: 1 },
  )
})

test('a deletion or skip spans the reference bases it removes', () => {
  expect(opened({ type: 'deletion', position: 100, length: 50 })).toMatchObject(
    { start: 100, end: 150, length: 50 },
  )
  const mismatch = opened({ type: 'mismatch', position: 100, length: 1 })
  expect(mismatch).toMatchObject({ start: 100, end: 101 })
  expect(mismatch).not.toHaveProperty('length')
})
