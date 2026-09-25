import {
  clusterProvenanceFromRegions,
  clusterProvenanceLocLabel,
  describeClusterProvenance,
} from './clusterProvenance.ts'

const ctgA = (start: number, end: number) => ({ refName: 'ctgA', start, end })

test('keeps only the fields that describe the locus', () => {
  const provenance = clusterProvenanceFromRegions([
    {
      refName: 'ctgA',
      start: 0,
      end: 100,
      assemblyName: 'volvox',
      // extra block fields (keys, offsets, widths) must not reach the snapshot.
      // The spread is load-bearing: it is what gets these past TypeScript's
      // excess-property check, so the test can hand in the wider object a real
      // block is. Inlining the keys makes it a type error, not a cleanup.
      // eslint-disable-next-line unicorn/no-useless-spread
      ...{ key: 'ctgA-0-100', offsetPx: 12, widthPx: 800 },
    },
  ])
  expect(provenance.regions).toEqual([
    { refName: 'ctgA', start: 0, end: 100, assemblyName: 'volvox' },
  ])
  expect(provenance.settings).toBeUndefined()
})

describe('labels', () => {
  test('a single region reads as a locstring', () => {
    expect(
      clusterProvenanceLocLabel(clusterProvenanceFromRegions([ctgA(0, 100)])),
    ).toBe('ctgA:1..100')
  })

  test('multiple regions name the first and count the rest', () => {
    expect(
      clusterProvenanceLocLabel(
        clusterProvenanceFromRegions([ctgA(0, 100), ctgA(500, 600)]),
      ),
    ).toBe('ctgA:1..100 +1 more')
  })

  test('the label leaves the assembly out, since the caption sits inside one view', () => {
    expect(
      clusterProvenanceLocLabel(
        clusterProvenanceFromRegions([
          { refName: 'ctgA', start: 0, end: 50000, assemblyName: 'volvox' },
        ]),
      ),
    ).toBe('ctgA:1..50,000')
  })

  test('the caption carries the settings that changed the matrix', () => {
    expect(
      describeClusterProvenance(
        clusterProvenanceFromRegions(
          [ctgA(0, 100)],
          [{ name: 'MAF filter', value: '0.05' }],
        ),
      ),
    ).toBe('Clustered on ctgA:1..100 · MAF filter: 0.05')
  })
})
