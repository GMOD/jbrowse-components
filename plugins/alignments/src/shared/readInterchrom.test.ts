import { buildReadInterchrom } from './readInterchrom.ts'

describe('buildReadInterchrom', () => {
  test('flags reads whose mate is on a different chromosome', () => {
    expect(
      Array.from(buildReadInterchrom(['chr1', 'chr2', 'chr1'], 'chr1', 3)),
    ).toEqual([0, 1, 0])
  })

  test('empty mate ref (unpaired / no mate) is not interchromosomal', () => {
    expect(Array.from(buildReadInterchrom(['', 'chr2'], 'chr1', 2))).toEqual([
      0, 1,
    ])
  })

  test('undefined mate refs yields all zeros of the read count', () => {
    expect(Array.from(buildReadInterchrom(undefined, 'chr1', 3))).toEqual([
      0, 0, 0,
    ])
  })
})
